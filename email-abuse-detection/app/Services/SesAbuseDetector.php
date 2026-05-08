<?php

namespace App\Services;

/**
 * SES / Email API Abuse Detector
 *
 * Heuristic-based detection of cloud email API abuse patterns.
 * All analysis is passive — uses metadata, volume statistics, and
 * provider signals provided by the user. No active API calls or scanning.
 */
class SesAbuseDetector
{
    // Volume spike multiplier that constitutes "abnormal" sending
    private const SPIKE_MULTIPLIER_HIGH     = 10;
    private const SPIKE_MULTIPLIER_MEDIUM   = 3;

    // Volume thresholds for standalone risk (no baseline provided)
    private const HIGH_VOLUME_THRESHOLD     = 50000;
    private const MEDIUM_VOLUME_THRESHOLD   = 10000;

    // Reputation keywords that indicate degradation
    private const REPUTATION_RISK_KEYWORDS = [
        'blacklist'         => 30,
        'blocklist'         => 30,
        'spam'              => 25,
        'abuse'             => 25,
        'bounce rate high'  => 20,
        'complaint rate'    => 20,
        'suspended'         => 35,
        'deactivated'       => 30,
        'reputation'        => 15,
        'denylist'          => 30,
        'rbl'               => 25,
        'spamhaus'          => 35,
        'sorbs'             => 25,
        'barracuda'         => 20,
    ];

    // High-risk ESP / provider patterns indicating API usage
    private const HIGH_RISK_PROVIDERS = [
        'ses'        => 'AWS SES — verify sending quota, bounce/complaint rates',
        'sendgrid'   => 'SendGrid — verify API key scope and sending limits',
        'mailgun'    => 'Mailgun — verify API key and domain validation',
        'sparkpost'  => 'SparkPost — verify account reputation and limits',
        'mandrill'   => 'Mandrill — transactional ESP with API key risk',
        'postmark'   => 'Postmark — verify API token security',
        'brevo'      => 'Brevo/Sendinblue — verify API key exposure',
        'smtp.com'   => 'SMTP.com — verify account usage anomalies',
    ];

    /**
     * Analyze SES/API abuse heuristics for a domain.
     *
     * @param array $metadata  User-supplied sending metadata and signals
     */
    public function analyze(array $metadata = []): array
    {
        $score    = 0;
        $findings = [];

        // --- API key compromise indicator ---
        if (!empty($metadata['has_api_key_exposed'])) {
            $score += 35;
            $findings[] = 'API key exposure indicator present — immediate rotation and audit of sent messages required';
        }

        // --- Email provider risk ---
        $provider = strtolower($metadata['email_provider'] ?? '');
        foreach (self::HIGH_RISK_PROVIDERS as $key => $message) {
            if ($provider === $key || str_contains($provider, $key)) {
                $score += 10;
                $findings[] = 'Cloud ESP in use: ' . $message;
                break;
            }
        }

        // --- Volume spike analysis ---
        $volumeResult = $this->analyzeVolume(
            $metadata['daily_send_volume'] ?? null,
            $metadata['baseline_volume'] ?? null
        );
        if ($volumeResult['score'] > 0) {
            $score += $volumeResult['score'];
            $findings = array_merge($findings, $volumeResult['findings']);
        }

        // --- Reputation degradation signals ---
        $reputationResult = $this->analyzeReputationSignals(
            $metadata['reputation_signals'] ?? []
        );
        if ($reputationResult['score'] > 0) {
            $score += $reputationResult['score'];
            $findings = array_merge($findings, $reputationResult['findings']);
        }

        // --- Sudden outbound volume reported ---
        if (!empty($metadata['sudden_volume_spike'])) {
            $score += 30;
            $findings[] = 'Sudden outbound email volume spike reported — possible account compromise or runaway process';
        }

        // --- Unverified sending domain via API ---
        if (!empty($metadata['unverified_sending_domain'])) {
            $score += 20;
            $findings[] = 'Unverified sending domain in ESP account — spoofing risk via API';
        }

        // --- Misconfigured bounce handling ---
        if (!empty($metadata['no_bounce_handling'])) {
            $score += 15;
            $findings[] = 'No bounce/complaint handling configured — high reputation risk, may indicate bulk spam operation';
        }

        return [
            'ses_risk_score' => min($score, 100),
            'ses_findings'   => $findings,
        ];
    }

    /**
     * Evaluate daily send volume against baseline for spike detection.
     */
    private function analyzeVolume(?int $dailyVolume, ?int $baselineVolume): array
    {
        $score    = 0;
        $findings = [];

        if ($dailyVolume === null) {
            return ['score' => 0, 'findings' => []];
        }

        if ($baselineVolume !== null && $baselineVolume > 0) {
            $multiplier = $dailyVolume / $baselineVolume;

            if ($multiplier >= self::SPIKE_MULTIPLIER_HIGH) {
                $score += 30;
                $findings[] = sprintf(
                    'Abnormal sending spike: current volume (%s) is %.1fx the baseline (%s) — possible account takeover or runaway script',
                    number_format($dailyVolume),
                    $multiplier,
                    number_format($baselineVolume)
                );
            } elseif ($multiplier >= self::SPIKE_MULTIPLIER_MEDIUM) {
                $score += 20;
                $findings[] = sprintf(
                    'Elevated sending volume: current volume (%s) is %.1fx the baseline (%s) — monitor for abuse patterns',
                    number_format($dailyVolume),
                    $multiplier,
                    number_format($baselineVolume)
                );
            }
        } else {
            // No baseline — evaluate absolute thresholds
            if ($dailyVolume >= self::HIGH_VOLUME_THRESHOLD) {
                $score += 20;
                $findings[] = sprintf(
                    'High daily send volume (%s emails) with no baseline — unable to determine if this is anomalous',
                    number_format($dailyVolume)
                );
            } elseif ($dailyVolume >= self::MEDIUM_VOLUME_THRESHOLD) {
                $score += 10;
                $findings[] = sprintf(
                    'Moderate daily send volume (%s emails) — consider establishing a baseline for anomaly detection',
                    number_format($dailyVolume)
                );
            }
        }

        return ['score' => $score, 'findings' => $findings];
    }

    /**
     * Analyze reputation signal strings for known risk keywords.
     */
    private function analyzeReputationSignals(array $signals): array
    {
        if (empty($signals)) {
            return ['score' => 0, 'findings' => []];
        }

        $score        = 0;
        $findings     = [];
        $matched      = [];

        $combined = strtolower(implode(' ', $signals));

        foreach (self::REPUTATION_RISK_KEYWORDS as $keyword => $points) {
            if (str_contains($combined, $keyword) && !in_array($keyword, $matched)) {
                $score += $points;
                $matched[] = $keyword;
                $findings[] = "Reputation degradation signal detected: '{$keyword}' — indicates deliverability or blacklisting issue";
            }
        }

        // Cap reputation contribution
        return ['score' => min($score, 40), 'findings' => $findings];
    }
}
