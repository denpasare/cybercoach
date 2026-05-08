<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AnalysisRun extends Model
{
    protected $fillable = [
        'name',
        'total_domains',
        'high_risk_count',
        'medium_risk_count',
        'low_risk_count',
        'status',
        'notes',
    ];

    public function assets(): HasMany
    {
        return $this->hasMany(EmailRiskAsset::class);
    }
}
