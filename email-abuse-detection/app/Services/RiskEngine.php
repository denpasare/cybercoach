<?php

namespace App\Services;

/**
 * Risk Engine
 *
 * Aggregates scores from all detection modules and produces
 * a normalized 0–100 risk score with a categorical risk level.
 */
class RiskEngine
{
    // Score thresholds for risk levels
    private const CRITICAL_THRESHOLD = 75;
    private const HIGH_THRESHOLD     = 50;
    private const MEDIUM_THRESHOLD   = 25;

    // Module weight caps to prevent any single module dominating
    private const SMTP_CAP = 75;
    private const SES_CAP  = 75;
    private const DNS_CAP  = 50;

    /**
     * Compute aggregate risk score and level.
     *
     * @param int $smtpScore  Raw SMTP risk contribution (0–100)
     * @param int $sesScore   Raw SES/API risk contribution (0–100)
     * @param int $dnsScore   Raw DNS risk contribution (0–100)
     */
    public function calculate(int $smtpScore, int $sesScore, int $dnsScore): array
    {
        $cappedSmtp = min($smtpScore, self::SMTP_CAP);
        $cappedSes  = min($sesScore,  self::SES_CAP);
        $cappedDns  = min($dnsScore,  self::DNS_CAP);

        // Weighted blend: SMTP 40%, SES 40%, DNS 20%
        $weighted = ($cappedSmtp * 0.40) + ($cappedSes * 0.40) + ($cappedDns * 0.20);

        // Boost if multiple high-risk signals converge
        if ($cappedSmtp >= 40 && $cappedSes >= 40) {
            $weighted = min($weighted * 1.2, 100);
        }

        $score = (int) round(min($weighted, 100));
        $level = $this->determineLevel($score);

        return [
            'risk_score' => $score,
            'risk_level' => $level,
        ];
    }

    /**
     * Determine categorical risk level from numeric score.
     */
    public function determineLevel(int $score): string
    {
        if ($score >= self::CRITICAL_THRESHOLD) {
            return 'critical';
        }
        if ($score >= self::HIGH_THRESHOLD) {
            return 'high';
        }
        if ($score >= self::MEDIUM_THRESHOLD) {
            return 'medium';
        }
        return 'low';
    }

    /**
     * Build a human-readable summary of what drove the score.
     */
    public function buildSummary(array $asset): string
    {
        $parts = [];

        if ($asset['smtp_risk_score'] >= 40) {
            $parts[] = 'serious SMTP misconfiguration risk';
        } elseif ($asset['smtp_risk_score'] >= 20) {
            $parts[] = 'moderate SMTP risk';
        }

        if ($asset['ses_risk_score'] >= 40) {
            $parts[] = 'high SES/API abuse risk';
        } elseif ($asset['ses_risk_score'] >= 20) {
            $parts[] = 'moderate SES/API risk';
        }

        if ($asset['dns_risk_score'] >= 40) {
            $parts[] = 'critical DNS misconfiguration';
        } elseif ($asset['dns_risk_score'] >= 20) {
            $parts[] = 'DNS security gaps';
        }

        if (empty($parts)) {
            return 'No significant risk indicators detected.';
        }

        return 'Detected: ' . implode(', ', $parts) . '.';
    }
}
