<?php

namespace Database\Seeders;

use App\Models\AnalysisRun;
use App\Models\EmailRiskAsset;
use Illuminate\Database\Seeder;

class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        $run = AnalysisRun::create([
            'name'              => 'Demo — SME Infrastructure Audit',
            'total_domains'     => 8,
            'high_risk_count'   => 3,
            'medium_risk_count' => 3,
            'low_risk_count'    => 2,
            'status'            => 'complete',
        ]);

        $assets = [
            [
                'domain'             => 'legacy-retailer.com',
                'ip'                 => '185.10.22.44',
                'spf_status'         => 'missing',
                'dmarc_status'       => 'missing',
                'mx_status'          => 'valid',
                'mx_records'         => [['host' => 'mail.legacy-retailer.com', 'priority' => 10]],
                'smtp_risk_score'    => 75,
                'ses_risk_score'     => 10,
                'dns_risk_score'     => 50,
                'risk_score'         => 53,
                'risk_level'         => 'critical',
                'email_provider'     => null,
                'uses_php_mail'      => true,
                'open_relay_banner'  => true,
                'smtp_findings'      => [
                    'Missing SPF record — domain vulnerable to spoofing',
                    'Missing DMARC record — no email authentication policy',
                    'Open relay indicator detected in SMTP banner',
                    'PHP mail() function in use — bypasses authentication',
                ],
                'ses_findings'       => [],
                'reputation_signals' => ['spam', 'blacklist'],
            ],
            [
                'domain'             => 'startup-saas.io',
                'ip'                 => '34.201.55.12',
                'spf_status'         => 'pass',
                'dmarc_status'       => 'missing',
                'mx_status'          => 'valid',
                'mx_records'         => [['host' => 'inbound-smtp.us-east-1.amazonaws.com', 'priority' => 10]],
                'smtp_risk_score'    => 10,
                'ses_risk_score'     => 65,
                'dns_risk_score'     => 25,
                'risk_score'         => 41,
                'risk_level'         => 'high',
                'email_provider'     => 'AWS SES',
                'has_api_key_exposed' => true,
                'daily_send_volume'  => 45000,
                'baseline_volume'    => 3000,
                'smtp_findings'      => [
                    'Missing DMARC record — no email authentication policy',
                ],
                'ses_findings'       => [
                    'API key exposure indicator present — immediate rotation required',
                    'Abnormal sending spike: current volume (45,000) is 15.0x the baseline (3,000)',
                    'Cloud ESP in use: AWS SES — verify sending quota, bounce/complaint rates',
                ],
                'reputation_signals' => [],
            ],
            [
                'domain'             => 'marketing-agency.net',
                'ip'                 => '91.108.4.200',
                'spf_status'         => 'weak',
                'dmarc_status'       => 'weak',
                'mx_status'          => 'valid',
                'mx_records'         => [
                    ['host' => 'mx.sendgrid.net', 'priority' => 10],
                    ['host' => 'mx2.sendgrid.net', 'priority' => 20],
                ],
                'smtp_risk_score'    => 30,
                'ses_risk_score'     => 40,
                'dns_risk_score'     => 20,
                'risk_score'         => 34,
                'risk_level'         => 'high',
                'email_provider'     => 'SendGrid',
                'daily_send_volume'  => 120000,
                'baseline_volume'    => 30000,
                'smtp_findings'      => [
                    'SPF record uses ~all (softfail) — not fully enforced',
                    'DMARC policy set to p=none — monitoring only',
                ],
                'ses_findings'       => [
                    'Cloud ESP in use: SendGrid — verify API key scope and sending limits',
                    'Elevated sending volume (120,000) is 4.0x the baseline (30,000)',
                    'No bounce/complaint handling configured — high reputation risk',
                ],
                'reputation_signals' => ['complaint rate'],
            ],
            [
                'domain'             => 'consulting-firm.co.uk',
                'ip'                 => '89.200.14.55',
                'spf_status'         => 'pass',
                'dmarc_status'       => 'weak',
                'mx_status'          => 'valid',
                'mx_records'         => [['host' => 'smtp.office365.com', 'priority' => 0]],
                'smtp_risk_score'    => 10,
                'ses_risk_score'     => 15,
                'dns_risk_score'     => 10,
                'risk_score'         => 12,
                'risk_level'         => 'medium',
                'email_provider'     => 'Microsoft 365',
                'daily_send_volume'  => 2000,
                'smtp_findings'      => [
                    'DMARC policy set to p=none — monitoring only, not enforced',
                ],
                'ses_findings'       => [],
                'reputation_signals' => [],
            ],
            [
                'domain'             => 'ecommerce-shop.store',
                'ip'                 => '178.62.10.99',
                'spf_status'         => 'missing',
                'dmarc_status'       => 'pass',
                'mx_status'          => 'valid',
                'mx_records'         => [['host' => 'mx1.mailgun.org', 'priority' => 10]],
                'smtp_risk_score'    => 30,
                'ses_risk_score'     => 20,
                'dns_risk_score'     => 25,
                'risk_score'         => 26,
                'risk_level'         => 'medium',
                'email_provider'     => 'Mailgun',
                'uses_laravel_queue' => true,
                'smtp_findings'      => [
                    'Missing SPF record — domain vulnerable to spoofing',
                    'Laravel queue-based mail detected — verify rate limiting',
                ],
                'ses_findings'       => [
                    'Cloud ESP in use: Mailgun — verify API key and domain validation',
                ],
                'reputation_signals' => [],
            ],
            [
                'domain'             => 'nonprofit-org.org',
                'ip'                 => '162.55.33.201',
                'spf_status'         => 'pass',
                'dmarc_status'       => 'pass',
                'mx_status'          => 'valid',
                'mx_records'         => [
                    ['host' => 'aspmx.l.google.com', 'priority' => 1],
                    ['host' => 'alt1.aspmx.l.google.com', 'priority' => 5],
                ],
                'smtp_risk_score'    => 10,
                'ses_risk_score'     => 0,
                'dns_risk_score'     => 0,
                'risk_score'         => 4,
                'risk_level'         => 'low',
                'email_provider'     => 'Google Workspace',
                'smtp_findings'      => ['SMTP authentication status unconfirmed'],
                'ses_findings'       => [],
                'reputation_signals' => [],
            ],
            [
                'domain'             => 'fintech-startup.com',
                'ip'                 => '52.16.88.124',
                'spf_status'         => 'pass',
                'dmarc_status'       => 'pass',
                'mx_status'          => 'valid',
                'mx_records'         => [['host' => 'smtp.postmarkapp.com', 'priority' => 10]],
                'smtp_risk_score'    => 10,
                'ses_risk_score'     => 10,
                'dns_risk_score'     => 0,
                'risk_score'         => 8,
                'risk_level'         => 'low',
                'email_provider'     => 'Postmark',
                'smtp_findings'      => [],
                'ses_findings'       => [
                    'Cloud ESP in use: Postmark — verify API token security',
                ],
                'reputation_signals' => [],
            ],
            [
                'domain'             => 'old-gov-agency.gov',
                'ip'                 => '41.77.200.5',
                'spf_status'         => 'fail',
                'dmarc_status'       => 'missing',
                'mx_status'          => 'valid',
                'mx_records'         => [['host' => 'mail.old-gov-agency.gov', 'priority' => 10]],
                'smtp_risk_score'    => 55,
                'ses_risk_score'     => 0,
                'dns_risk_score'     => 40,
                'risk_score'         => 30,
                'risk_level'         => 'medium',
                'email_provider'     => null,
                'smtp_findings'      => [
                    'SPF record present but misconfigured',
                    'Missing DMARC record — no email authentication policy',
                    'Exposed SMTP endpoint reported',
                    'Legacy Sendmail detected — often misconfigured (MX: mail.old-gov-agency.gov)',
                ],
                'ses_findings'       => [],
                'reputation_signals' => ['reputation'],
            ],
        ];

        foreach ($assets as $data) {
            EmailRiskAsset::create(array_merge($data, ['analysis_run_id' => $run->id]));
        }
    }
}
