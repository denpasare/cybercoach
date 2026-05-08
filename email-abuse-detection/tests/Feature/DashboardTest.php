<?php

namespace Tests\Feature;

use App\Models\EmailRiskAsset;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_dashboard_loads(): void
    {
        $response = $this->get('/');
        $response->assertStatus(200);
        $response->assertSee('Email Risk Dashboard');
    }

    public function test_dashboard_shows_domain(): void
    {
        EmailRiskAsset::create([
            'domain'         => 'test-domain.com',
            'risk_level'     => 'high',
            'risk_score'     => 55,
            'smtp_risk_score' => 30,
            'ses_risk_score'  => 0,
            'dns_risk_score'  => 50,
            'spf_status'     => 'missing',
            'dmarc_status'   => 'missing',
            'mx_status'      => 'missing',
        ]);

        $response = $this->get('/');
        $response->assertStatus(200);
        $response->assertSee('test-domain.com');
    }

    public function test_dashboard_filter_by_risk_level(): void
    {
        EmailRiskAsset::create([
            'domain'          => 'high-risk.com',
            'risk_level'      => 'high',
            'risk_score'      => 60,
            'smtp_risk_score' => 0,
            'ses_risk_score'  => 0,
            'dns_risk_score'  => 0,
            'spf_status'      => 'pass',
            'dmarc_status'    => 'pass',
            'mx_status'       => 'valid',
        ]);

        EmailRiskAsset::create([
            'domain'          => 'low-risk.com',
            'risk_level'      => 'low',
            'risk_score'      => 5,
            'smtp_risk_score' => 0,
            'ses_risk_score'  => 0,
            'dns_risk_score'  => 0,
            'spf_status'      => 'pass',
            'dmarc_status'    => 'pass',
            'mx_status'       => 'valid',
        ]);

        $response = $this->get('/?risk_level=high');
        $response->assertStatus(200);
        $response->assertSee('high-risk.com');
        $response->assertDontSee('low-risk.com');
    }

    public function test_asset_detail_page_loads(): void
    {
        $asset = EmailRiskAsset::create([
            'domain'          => 'detail-test.com',
            'risk_level'      => 'medium',
            'risk_score'      => 35,
            'smtp_risk_score' => 20,
            'ses_risk_score'  => 10,
            'dns_risk_score'  => 25,
            'spf_status'      => 'missing',
            'dmarc_status'    => 'weak',
            'mx_status'       => 'valid',
            'smtp_findings'   => ['Missing SPF record'],
            'ses_findings'    => [],
        ]);

        $response = $this->get("/assets/{$asset->id}");
        $response->assertStatus(200);
        $response->assertSee('detail-test.com');
        $response->assertSee('Missing SPF record');
    }

    public function test_analyze_page_loads(): void
    {
        $response = $this->get('/analyze');
        $response->assertStatus(200);
        $response->assertSee('Analyze Email Infrastructure');
    }

    public function test_export_returns_csv(): void
    {
        EmailRiskAsset::create([
            'domain'          => 'export-test.com',
            'risk_level'      => 'low',
            'risk_score'      => 5,
            'smtp_risk_score' => 0,
            'ses_risk_score'  => 0,
            'dns_risk_score'  => 0,
            'spf_status'      => 'pass',
            'dmarc_status'    => 'pass',
            'mx_status'       => 'valid',
        ]);

        $response = $this->get('/export');
        $response->assertStatus(200);
        $response->assertHeader('Content-Type', 'text/csv; charset=UTF-8');

        // Stream responses: capture via streamed content
        ob_start();
        $response->sendContent();
        $body = ob_get_clean();

        $this->assertStringContainsString('export-test.com', $body);
    }

    public function test_single_domain_analysis_stores_asset(): void
    {
        $response = $this->post('/analyze/single', [
            'domain' => 'phpunit-test-example.com',
        ]);

        // Should redirect to the asset detail page
        $response->assertRedirect();
        $this->assertDatabaseHas('email_risk_assets', ['domain' => 'phpunit-test-example.com']);
    }

    public function test_invalid_domain_rejected(): void
    {
        $response = $this->post('/analyze/single', [
            'domain' => 'not a valid domain!!',
        ]);

        $response->assertSessionHasErrors('domain');
    }
}
