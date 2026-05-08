<?php

namespace Tests\Unit;

use App\Services\RiskEngine;
use PHPUnit\Framework\TestCase;

class RiskEngineTest extends TestCase
{
    private RiskEngine $engine;

    protected function setUp(): void
    {
        parent::setUp();
        $this->engine = new RiskEngine();
    }

    public function test_low_risk_all_zeros(): void
    {
        $result = $this->engine->calculate(0, 0, 0);
        $this->assertEquals(0, $result['risk_score']);
        $this->assertEquals('low', $result['risk_level']);
    }

    public function test_critical_risk_high_smtp_and_ses(): void
    {
        // SMTP 75 + SES 75 + DNS 50 should breach critical threshold
        $result = $this->engine->calculate(75, 75, 50);
        $this->assertGreaterThanOrEqual(75, $result['risk_score']);
        $this->assertEquals('critical', $result['risk_level']);
    }

    public function test_missing_spf_and_dmarc_produces_nonzero_score(): void
    {
        // DNS score of 50 (both SPF and DMARC missing), no SMTP or SES risk
        // DNS weight is 20%, so: 0*0.4 + 0*0.4 + 50*0.2 = 10
        $result = $this->engine->calculate(0, 0, 50);
        $this->assertGreaterThanOrEqual(10, $result['risk_score']);
    }

    public function test_open_relay_flags_high_smtp_score(): void
    {
        // Open relay = +30, PHP mail = +25 → smtp score of 55
        $result = $this->engine->calculate(55, 0, 0);
        $this->assertGreaterThanOrEqual(20, $result['risk_score']);
    }

    public function test_score_capped_at_100(): void
    {
        $result = $this->engine->calculate(100, 100, 100);
        $this->assertLessThanOrEqual(100, $result['risk_score']);
    }

    public function test_determine_level_thresholds(): void
    {
        $this->assertEquals('low',      $this->engine->determineLevel(0));
        $this->assertEquals('low',      $this->engine->determineLevel(24));
        $this->assertEquals('medium',   $this->engine->determineLevel(25));
        $this->assertEquals('medium',   $this->engine->determineLevel(49));
        $this->assertEquals('high',     $this->engine->determineLevel(50));
        $this->assertEquals('high',     $this->engine->determineLevel(74));
        $this->assertEquals('critical', $this->engine->determineLevel(75));
        $this->assertEquals('critical', $this->engine->determineLevel(100));
    }

    public function test_convergence_boost_applies_when_smtp_and_ses_both_high(): void
    {
        $with_both_high  = $this->engine->calculate(50, 50, 0);
        $with_only_smtp  = $this->engine->calculate(50, 0, 0);
        $this->assertGreaterThan($with_only_smtp['risk_score'], $with_both_high['risk_score']);
    }
}
