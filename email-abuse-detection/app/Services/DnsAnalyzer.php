<?php

namespace App\Services;

/**
 * DNS Email Security Analyzer
 *
 * Performs passive DNS lookups only — no active scanning.
 * Checks SPF, DMARC, and MX records for a given domain.
 */
class DnsAnalyzer
{
    /**
     * Analyze all DNS email security records for a domain.
     */
    public function analyze(string $domain): array
    {
        $spf   = $this->checkSpf($domain);
        $dmarc = $this->checkDmarc($domain);
        $mx    = $this->checkMx($domain);

        $dnsRiskScore = 0;
        $findings     = [];

        if ($spf['status'] === 'missing') {
            $dnsRiskScore += 25;
            $findings[] = 'Missing SPF record — domain vulnerable to spoofing';
        } elseif ($spf['status'] === 'fail') {
            $dnsRiskScore += 15;
            $findings[] = 'SPF record present but misconfigured';
        } elseif ($spf['status'] === 'weak') {
            $dnsRiskScore += 10;
            $findings[] = 'SPF record uses ~all (softfail) — not fully enforced';
        }

        if ($dmarc['status'] === 'missing') {
            $dnsRiskScore += 25;
            $findings[] = 'Missing DMARC record — no email authentication policy';
        } elseif ($dmarc['status'] === 'weak') {
            $dnsRiskScore += 10;
            $findings[] = 'DMARC policy set to p=none — monitoring only, not enforced';
        }

        if ($mx['status'] === 'missing') {
            $dnsRiskScore += 5;
            $findings[] = 'No MX records found — domain may use non-standard mail routing';
        }

        return [
            'spf_status'   => $spf['status'],
            'spf_record'   => $spf['record'],
            'dmarc_status' => $dmarc['status'],
            'dmarc_record' => $dmarc['record'],
            'mx_records'   => $mx['records'],
            'mx_status'    => $mx['status'],
            'dns_risk_score' => min($dnsRiskScore, 50),
            'findings'     => $findings,
        ];
    }

    /**
     * Retrieve and evaluate the SPF TXT record.
     */
    public function checkSpf(string $domain): array
    {
        try {
            $records = @dns_get_record($domain, DNS_TXT);

            if ($records === false || empty($records)) {
                return ['status' => 'missing', 'record' => null];
            }

            foreach ($records as $record) {
                $txt = $record['txt'] ?? $record['entries'][0] ?? '';

                if (stripos($txt, 'v=spf1') !== false) {
                    return [
                        'status' => $this->evaluateSpfRecord($txt),
                        'record' => $txt,
                    ];
                }
            }

            return ['status' => 'missing', 'record' => null];
        } catch (\Throwable $e) {
            return ['status' => 'error', 'record' => null];
        }
    }

    private function evaluateSpfRecord(string $record): string
    {
        $lower = strtolower($record);

        // Hard fail is best practice
        if (str_contains($lower, '-all')) {
            return 'pass';
        }

        // Softfail — permissive
        if (str_contains($lower, '~all')) {
            return 'weak';
        }

        // Neutral or allow-all — dangerous
        if (str_contains($lower, '+all') || str_contains($lower, '?all')) {
            return 'fail';
        }

        // No explicit all mechanism
        return 'weak';
    }

    /**
     * Retrieve and evaluate the DMARC record at _dmarc.<domain>.
     */
    public function checkDmarc(string $domain): array
    {
        try {
            $dmarcDomain = '_dmarc.' . $domain;
            $records     = @dns_get_record($dmarcDomain, DNS_TXT);

            if ($records === false || empty($records)) {
                return ['status' => 'missing', 'record' => null];
            }

            foreach ($records as $record) {
                $txt = $record['txt'] ?? $record['entries'][0] ?? '';

                if (stripos($txt, 'v=DMARC1') !== false) {
                    return [
                        'status' => $this->evaluateDmarcRecord($txt),
                        'record' => $txt,
                    ];
                }
            }

            return ['status' => 'missing', 'record' => null];
        } catch (\Throwable $e) {
            return ['status' => 'error', 'record' => null];
        }
    }

    private function evaluateDmarcRecord(string $record): string
    {
        if (preg_match('/p=(reject|quarantine)/i', $record)) {
            return 'pass';
        }

        if (preg_match('/p=none/i', $record)) {
            return 'weak';
        }

        return 'fail';
    }

    /**
     * Retrieve MX records for the domain.
     */
    public function checkMx(string $domain): array
    {
        try {
            $records = @dns_get_record($domain, DNS_MX);

            if ($records === false || empty($records)) {
                return ['status' => 'missing', 'records' => []];
            }

            $mx = array_map(fn($r) => [
                'host'     => $r['target'] ?? '',
                'priority' => $r['pri'] ?? 0,
            ], $records);

            usort($mx, fn($a, $b) => $a['priority'] <=> $b['priority']);

            return ['status' => 'valid', 'records' => $mx];
        } catch (\Throwable $e) {
            return ['status' => 'error', 'records' => []];
        }
    }
}
