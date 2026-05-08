<?php

namespace App\Services;

use App\Models\AnalysisRun;
use App\Models\EmailRiskAsset;

/**
 * EmailAbuseAnalyzer
 *
 * Orchestrates all detection modules for a single domain analysis.
 */
class EmailAbuseAnalyzer
{
    public function __construct(
        private readonly DnsAnalyzer          $dnsAnalyzer,
        private readonly SmtpMisconfigDetector $smtpDetector,
        private readonly SesAbuseDetector      $sesDetector,
        private readonly RiskEngine            $riskEngine,
    ) {}

    /**
     * Analyze a single domain with optional metadata.
     *
     * @param string $domain    The domain to analyze
     * @param array  $metadata  Optional user-supplied metadata flags and signals
     * @param int|null $runId   Optional analysis run ID for grouping
     */
    public function analyzeDomain(string $domain, array $metadata = [], ?int $runId = null): EmailRiskAsset
    {
        $domain = strtolower(trim($domain));

        // 1. DNS analysis
        $dns = $this->dnsAnalyzer->analyze($domain);

        // 2. SMTP misconfiguration detection
        $smtp = $this->smtpDetector->analyze(
            $dns['mx_records'] ?? [],
            $metadata
        );

        // Detect email provider from MX if not provided
        if (empty($metadata['email_provider']) && !empty($smtp['detected_provider'])) {
            $metadata['email_provider'] = $smtp['detected_provider'];
        }

        // 3. SES/API abuse detection
        $ses = $this->sesDetector->analyze($metadata);

        // 4. Risk Engine — aggregate score
        $risk = $this->riskEngine->calculate(
            $smtp['smtp_risk_score'],
            $ses['ses_risk_score'],
            $dns['dns_risk_score']
        );

        // 5. Build and persist the asset record
        $asset = EmailRiskAsset::updateOrCreate(
            [
                'domain'          => $domain,
                'analysis_run_id' => $runId,
            ],
            [
                'ip'                  => $metadata['ip'] ?? null,
                'spf_status'          => $dns['spf_status'],
                'spf_record'          => $dns['spf_record'],
                'dmarc_status'        => $dns['dmarc_status'],
                'dmarc_record'        => $dns['dmarc_record'],
                'mx_records'          => $dns['mx_records'],
                'mx_status'           => $dns['mx_status'],
                'dns_risk_score'      => $dns['dns_risk_score'],
                'smtp_risk_score'     => $smtp['smtp_risk_score'],
                'smtp_findings'       => array_merge($dns['findings'], $smtp['smtp_findings']),
                'ses_risk_score'      => $ses['ses_risk_score'],
                'ses_findings'        => $ses['ses_findings'],
                'risk_score'          => $risk['risk_score'],
                'risk_level'          => $risk['risk_level'],
                'email_provider'      => $metadata['email_provider'] ?? null,
                'daily_send_volume'   => isset($metadata['daily_send_volume']) ? (int) $metadata['daily_send_volume'] : null,
                'baseline_volume'     => isset($metadata['baseline_volume']) ? (int) $metadata['baseline_volume'] : null,
                'has_api_key_exposed' => !empty($metadata['has_api_key_exposed']),
                'uses_php_mail'       => !empty($metadata['uses_php_mail']),
                'uses_laravel_queue'  => !empty($metadata['uses_laravel_queue']),
                'open_relay_banner'   => !empty($metadata['open_relay_banner']),
                'reputation_signals'  => $metadata['reputation_signals'] ?? [],
            ]
        );

        return $asset;
    }

    /**
     * Analyze a batch of domains, all within a single analysis run.
     *
     * @param array  $rows  Each row: ['domain' => ..., 'ip' => ..., ...metadata]
     * @param string $runName
     */
    public function analyzeBatch(array $rows, string $runName = ''): AnalysisRun
    {
        $run = AnalysisRun::create([
            'name'          => $runName ?: 'Batch ' . now()->format('Y-m-d H:i'),
            'total_domains' => count($rows),
            'status'        => 'running',
        ]);

        $counts = ['critical' => 0, 'high' => 0, 'medium' => 0, 'low' => 0];

        foreach ($rows as $row) {
            $domain   = trim($row['domain'] ?? '');
            if (empty($domain)) {
                continue;
            }

            $metadata = $row;
            unset($metadata['domain']);

            $asset = $this->analyzeDomain($domain, $metadata, $run->id);
            $counts[$asset->risk_level] = ($counts[$asset->risk_level] ?? 0) + 1;
        }

        $run->update([
            'status'            => 'complete',
            'high_risk_count'   => ($counts['critical'] ?? 0) + ($counts['high'] ?? 0),
            'medium_risk_count' => $counts['medium'] ?? 0,
            'low_risk_count'    => $counts['low'] ?? 0,
        ]);

        return $run;
    }
}
