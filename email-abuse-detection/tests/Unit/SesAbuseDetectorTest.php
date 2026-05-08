<?php

namespace Tests\Unit;

use App\Services\SesAbuseDetector;
use PHPUnit\Framework\TestCase;

class SesAbuseDetectorTest extends TestCase
{
    private SesAbuseDetector $detector;

    protected function setUp(): void
    {
        parent::setUp();
        $this->detector = new SesAbuseDetector();
    }

    public function test_no_metadata_yields_zero_score(): void
    {
        $result = $this->detector->analyze([]);
        $this->assertEquals(0, $result['ses_risk_score']);
        $this->assertEmpty($result['ses_findings']);
    }

    public function test_api_key_exposed_adds_critical_score(): void
    {
        $result = $this->detector->analyze(['has_api_key_exposed' => true]);
        $this->assertGreaterThanOrEqual(35, $result['ses_risk_score']);
        $this->assertNotEmpty($result['ses_findings']);
    }

    public function test_volume_spike_detected(): void
    {
        $result = $this->detector->analyze([
            'daily_send_volume' => 100000,
            'baseline_volume'   => 1000,
        ]);
        $this->assertGreaterThanOrEqual(30, $result['ses_risk_score']);
        $this->assertNotEmpty($result['ses_findings']);
    }

    public function test_moderate_volume_increase_detected(): void
    {
        $result = $this->detector->analyze([
            'daily_send_volume' => 5000,
            'baseline_volume'   => 1000,
        ]);
        // 5x baseline — medium spike
        $this->assertGreaterThanOrEqual(20, $result['ses_risk_score']);
    }

    public function test_reputation_blacklist_signal(): void
    {
        $result = $this->detector->analyze([
            'reputation_signals' => ['blacklist', 'spam complaints'],
        ]);
        $this->assertGreaterThanOrEqual(30, $result['ses_risk_score']);
        $this->assertNotEmpty($result['ses_findings']);
    }

    public function test_score_capped_at_100(): void
    {
        $result = $this->detector->analyze([
            'has_api_key_exposed'  => true,
            'sudden_volume_spike'  => true,
            'no_bounce_handling'   => true,
            'reputation_signals'   => ['blacklist', 'suspended', 'spamhaus'],
            'daily_send_volume'    => 999999,
            'baseline_volume'      => 100,
        ]);
        $this->assertLessThanOrEqual(100, $result['ses_risk_score']);
    }

    public function test_known_esp_provider_flagged(): void
    {
        $result = $this->detector->analyze(['email_provider' => 'ses']);
        $this->assertGreaterThan(0, $result['ses_risk_score']);
        $this->assertNotEmpty($result['ses_findings']);
    }
}
