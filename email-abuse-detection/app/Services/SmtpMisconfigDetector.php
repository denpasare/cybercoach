<?php

namespace App\Services;

/**
 * SMTP Misconfiguration Detector
 *
 * Performs passive/metadata analysis only — no active exploitation.
 * Uses MX banner-pattern matching, DNS metadata, and user-supplied
 * infrastructure hints to flag misconfiguration risks.
 */
class SmtpMisconfigDetector
{
    // Known insecure / deprecated MTA patterns in hostnames/banners
    private const INSECURE_MTA_PATTERNS = [
        'sendmail'      => 'Legacy Sendmail detected — often misconfigured',
        'exim'          => 'Exim MTA detected — verify relay configuration',
        'postfix'       => 'Postfix detected — verify open relay and auth config',
        'qmail'         => 'qmail detected — outdated, review relay policy',
        'iis smtp'      => 'IIS SMTP detected — frequent misconfiguration target',
        'mdaemon'       => 'MDaemon detected — verify authentication settings',
        'kerio'         => 'Kerio Connect detected — review relay policy',
        'lotus domino'  => 'Lotus Domino SMTP detected — legacy system risk',
        'communigate'   => 'CommuniGate SMTP detected — review relay settings',
        'mailenable'    => 'MailEnable detected — historically vulnerable',
    ];

    // Open relay / permissive SMTP indicator patterns in banner strings
    private const OPEN_RELAY_INDICATORS = [
        'relaying allowed',
        'relay access',
        'this server allows relaying',
        'open relay',
        'relaying permitted',
        'welcome to the mailserver',
    ];

    // Known cloud/bulk ESPs — used to detect SES-style provider usage via MX
    private const CLOUD_ESP_MX_PATTERNS = [
        'amazonses.com'      => 'AWS SES',
        'sendgrid.net'       => 'SendGrid',
        'mailgun.org'        => 'Mailgun',
        'sparkpostmail.com'  => 'SparkPost',
        'mandrillapp.com'    => 'Mandrill',
        'mailchimp.com'      => 'Mailchimp',
        'postmarkapp.com'    => 'Postmark',
        'smtp.com'           => 'SMTP.com',
        'sendinblue.com'     => 'Brevo/Sendinblue',
        'brevo.com'          => 'Brevo',
    ];

    /**
     * Analyze SMTP misconfiguration risk based on DNS metadata and user inputs.
     *
     * @param array $mxRecords  MX records from DnsAnalyzer
     * @param array $metadata   User-supplied asset metadata (flags, provider info)
     */
    public function analyze(array $mxRecords, array $metadata = []): array
    {
        $score    = 0;
        $findings = [];
        $detectedProvider = null;

        // --- Analyze MX record hostnames ---
        foreach ($mxRecords as $mx) {
            $host = strtolower($mx['host'] ?? '');

            foreach (self::INSECURE_MTA_PATTERNS as $pattern => $message) {
                if (str_contains($host, $pattern)) {
                    $score += 15;
                    $findings[] = $message . " (MX: {$mx['host']})";
                }
            }

            foreach (self::OPEN_RELAY_INDICATORS as $indicator) {
                if (str_contains($host, $indicator)) {
                    $score += 30;
                    $findings[] = 'Open relay indicator detected in MX hostname';
                }
            }

            foreach (self::CLOUD_ESP_MX_PATTERNS as $pattern => $provider) {
                if (str_contains($host, $pattern)) {
                    $detectedProvider = $provider;
                }
            }
        }

        // --- Open relay banner flag (metadata input) ---
        if (!empty($metadata['open_relay_banner'])) {
            $score += 30;
            $findings[] = 'Open relay indicator detected in SMTP banner — server accepts third-party mail without authentication';
        }

        // --- PHP mail() abuse ---
        if (!empty($metadata['uses_php_mail'])) {
            $score += 25;
            $findings[] = 'PHP mail() function in use — bypasses authentication, easily abused for spam injection';
        }

        // --- Laravel queue mail ---
        if (!empty($metadata['uses_laravel_queue'])) {
            $score += 20;
            $findings[] = 'Laravel queue-based mail detected — verify rate limiting and queue worker configuration to prevent email queue explosion';
        }

        // --- Exposed / unauthenticated SMTP endpoint ---
        if (!empty($metadata['exposed_smtp'])) {
            $score += 20;
            $findings[] = 'Exposed SMTP endpoint reported — verify authentication requirements and TLS enforcement';
        }

        // --- Missing SMTP authentication indicators ---
        if (empty($metadata['smtp_auth_confirmed']) && empty($mxRecords)) {
            $score += 20;
            $findings[] = 'No MX records and no SMTP authentication confirmation — mail sending path is unclear';
        } elseif (empty($metadata['smtp_auth_confirmed']) && !empty($mxRecords)) {
            $score += 10;
            $findings[] = 'SMTP authentication status unconfirmed';
        }

        return [
            'smtp_risk_score'   => min($score, 100),
            'smtp_findings'     => $findings,
            'detected_provider' => $detectedProvider,
        ];
    }

    /**
     * Check if an MX hostname belongs to a known cloud ESP.
     */
    public function detectEmailProvider(array $mxRecords): ?string
    {
        foreach ($mxRecords as $mx) {
            $host = strtolower($mx['host'] ?? '');
            foreach (self::CLOUD_ESP_MX_PATTERNS as $pattern => $provider) {
                if (str_contains($host, $pattern)) {
                    return $provider;
                }
            }
        }

        return null;
    }
}
