<?php

namespace Tests\Unit;

use App\Services\SmtpMisconfigDetector;
use PHPUnit\Framework\TestCase;

class SmtpMisconfigDetectorTest extends TestCase
{
    private SmtpMisconfigDetector $detector;

    protected function setUp(): void
    {
        parent::setUp();
        $this->detector = new SmtpMisconfigDetector();
    }

    public function test_no_mx_no_metadata_yields_nonzero(): void
    {
        // No MX + no smtp_auth_confirmed = unclear path
        $result = $this->detector->analyze([], []);
        $this->assertGreaterThan(0, $result['smtp_risk_score']);
    }

    public function test_open_relay_banner_adds_score(): void
    {
        $result = $this->detector->analyze([], ['open_relay_banner' => true]);
        $this->assertGreaterThanOrEqual(30, $result['smtp_risk_score']);
        $this->assertNotEmpty($result['smtp_findings']);
    }

    public function test_php_mail_adds_score(): void
    {
        $result = $this->detector->analyze([], ['uses_php_mail' => true, 'smtp_auth_confirmed' => true]);
        $this->assertGreaterThanOrEqual(25, $result['smtp_risk_score']);
    }

    public function test_laravel_queue_adds_score(): void
    {
        $result = $this->detector->analyze([], ['uses_laravel_queue' => true, 'smtp_auth_confirmed' => true]);
        $this->assertGreaterThanOrEqual(20, $result['smtp_risk_score']);
    }

    public function test_sendmail_mx_hostname_flagged(): void
    {
        $mx = [['host' => 'sendmail.example.com', 'priority' => 10]];
        $result = $this->detector->analyze($mx, ['smtp_auth_confirmed' => true]);
        $this->assertGreaterThan(0, $result['smtp_risk_score']);
        $this->assertNotEmpty($result['smtp_findings']);
    }

    public function test_cloud_esp_mx_detected(): void
    {
        $mx = [['host' => 'mta.sendgrid.net', 'priority' => 10]];
        $result = $this->detector->analyze($mx, ['smtp_auth_confirmed' => true]);
        $this->assertEquals('SendGrid', $result['detected_provider']);
    }

    public function test_score_capped_at_100(): void
    {
        $result = $this->detector->analyze(
            [['host' => 'sendmail.example.com', 'priority' => 10]],
            [
                'open_relay_banner'  => true,
                'uses_php_mail'      => true,
                'uses_laravel_queue' => true,
                'exposed_smtp'       => true,
            ]
        );
        $this->assertLessThanOrEqual(100, $result['smtp_risk_score']);
    }
}
