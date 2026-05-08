<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmailRiskAsset extends Model
{
    protected $fillable = [
        'analysis_run_id',
        'domain',
        'ip',
        'spf_status',
        'dmarc_status',
        'mx_records',
        'mx_status',
        'spf_record',
        'dmarc_record',
        'smtp_risk_score',
        'smtp_findings',
        'ses_risk_score',
        'ses_findings',
        'dns_risk_score',
        'risk_score',
        'risk_level',
        'daily_send_volume',
        'email_provider',
        'has_api_key_exposed',
        'uses_php_mail',
        'uses_laravel_queue',
        'open_relay_banner',
        'baseline_volume',
        'reputation_signals',
    ];

    protected $casts = [
        'mx_records'         => 'array',
        'smtp_findings'      => 'array',
        'ses_findings'       => 'array',
        'reputation_signals' => 'array',
        'has_api_key_exposed' => 'boolean',
        'uses_php_mail'      => 'boolean',
        'uses_laravel_queue' => 'boolean',
        'open_relay_banner'  => 'boolean',
    ];

    public function analysisRun(): BelongsTo
    {
        return $this->belongsTo(AnalysisRun::class);
    }

    public function getRiskBadgeClassAttribute(): string
    {
        return match ($this->risk_level) {
            'critical' => 'badge-critical',
            'high'     => 'badge-high',
            'medium'   => 'badge-medium',
            default    => 'badge-low',
        };
    }

    public function getAllFindingsAttribute(): array
    {
        return array_merge(
            $this->smtp_findings ?? [],
            $this->ses_findings ?? [],
        );
    }
}
