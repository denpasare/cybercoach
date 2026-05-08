@extends('layouts.app')

@section('title', $asset->domain . ' — Risk Report')

@section('content')
<div class="page-header">
    <div>
        <h2>{{ $asset->domain }}</h2>
        <div class="subtitle">
            Full Risk Report &bull;
            Analyzed {{ $asset->created_at->diffForHumans() }}
            @if($asset->ip)
                &bull; IP: {{ $asset->ip }}
            @endif
        </div>
    </div>
    <div style="display:flex;gap:10px;">
        <a href="{{ route('dashboard') }}" class="btn btn-outline">&#8592; Dashboard</a>
        <a href="{{ route('analyze.create') }}" class="btn btn-outline">Re-Analyze</a>
        <form method="POST" action="{{ route('assets.destroy', $asset) }}" onsubmit="return confirm('Delete this asset?')">
            @csrf @method('DELETE')
            <button class="btn btn-danger btn-sm" type="submit">Delete</button>
        </form>
    </div>
</div>

{{-- Score Summary --}}
<div class="card">
    <div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap;">
        @php
            $scoreColor = match($asset->risk_level) {
                'critical' => '#ff4d4d',
                'high'     => '#f97316',
                'medium'   => '#eab308',
                default    => '#22c55e',
            };
        @endphp
        <div class="score-ring {{ $asset->risk_level }}">{{ $asset->risk_score }}</div>

        <div style="flex:1;min-width:200px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
                <span style="font-size:20px;font-weight:700;color:{{ $scoreColor }}">
                    {{ strtoupper($asset->risk_level) }} RISK
                </span>
                <span class="badge badge-{{ $asset->risk_level }}">{{ $asset->risk_level }}</span>
            </div>
            <div style="font-size:13px;color:var(--text-dim);max-width:500px;">
                @if($asset->email_provider)
                    Provider: <strong style="color:var(--text)">{{ $asset->email_provider }}</strong> &bull;
                @endif
                SMTP: <strong style="color:{{ $asset->smtp_risk_score >= 40 ? '#f97316' : 'var(--text)' }}">{{ $asset->smtp_risk_score }}</strong> &bull;
                SES/API: <strong style="color:{{ $asset->ses_risk_score >= 40 ? '#f97316' : 'var(--text)' }}">{{ $asset->ses_risk_score }}</strong> &bull;
                DNS: <strong style="color:{{ $asset->dns_risk_score >= 40 ? '#f97316' : 'var(--text)' }}">{{ $asset->dns_risk_score }}</strong>
            </div>
        </div>

        {{-- Score Bars --}}
        <div style="display:flex;flex-direction:column;gap:8px;min-width:220px;">
            @foreach([
                ['SMTP Misconfig', $asset->smtp_risk_score, '#f97316'],
                ['SES/API Abuse', $asset->ses_risk_score, '#58a6ff'],
                ['DNS Security', $asset->dns_risk_score, '#eab308'],
            ] as [$label, $val, $color])
            <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:11px;color:var(--text-dim);width:100px;text-align:right;">{{ $label }}</span>
                <div class="score-bar" style="width:120px;">
                    <div class="score-bar-fill" style="width:{{ $val }}%;background:{{ $color }};"></div>
                </div>
                <span style="font-size:12px;font-weight:600;color:{{ $color }};width:28px;">{{ $val }}</span>
            </div>
            @endforeach
        </div>
    </div>
</div>

{{-- DNS Security Analysis --}}
<div class="card">
    <div class="card-title">DNS Email Security</div>
    <div class="detail-grid">
        <div class="detail-item">
            <label>SPF Status</label>
            <div class="value">
                <span class="badge badge-{{ $asset->spf_status }}">{{ $asset->spf_status }}</span>
                @if($asset->spf_status === 'missing')
                    <span style="font-size:12px;color:var(--critical);margin-left:8px;">+25 risk</span>
                @elseif($asset->spf_status === 'weak')
                    <span style="font-size:12px;color:var(--medium);margin-left:8px;">+10 risk</span>
                @endif
            </div>
            @if($asset->spf_record)
                <div class="code-block" style="margin-top:8px;">{{ $asset->spf_record }}</div>
            @endif
        </div>
        <div class="detail-item">
            <label>DMARC Status</label>
            <div class="value">
                <span class="badge badge-{{ $asset->dmarc_status }}">{{ $asset->dmarc_status }}</span>
                @if($asset->dmarc_status === 'missing')
                    <span style="font-size:12px;color:var(--critical);margin-left:8px;">+25 risk</span>
                @elseif($asset->dmarc_status === 'weak')
                    <span style="font-size:12px;color:var(--medium);margin-left:8px;">+10 risk</span>
                @endif
            </div>
            @if($asset->dmarc_record)
                <div class="code-block" style="margin-top:8px;">{{ $asset->dmarc_record }}</div>
            @endif
        </div>
        <div class="detail-item" style="grid-column:1/-1;">
            <label>MX Records <span class="badge badge-{{ $asset->mx_status }}" style="margin-left:6px;">{{ $asset->mx_status }}</span></label>
            @if(!empty($asset->mx_records))
                <div style="display:flex;flex-direction:column;gap:4px;margin-top:6px;">
                    @foreach($asset->mx_records as $mx)
                        <div class="code-block" style="display:inline-block;">
                            Priority {{ $mx['priority'] ?? 0 }}: {{ $mx['host'] ?? '' }}
                        </div>
                    @endforeach
                </div>
            @else
                <div style="color:var(--text-dim);font-size:13px;margin-top:4px;">No MX records found</div>
            @endif
        </div>
    </div>
</div>

{{-- Findings --}}
@php
    $smtpFindings = $asset->smtp_findings ?? [];
    $sesFindings  = $asset->ses_findings ?? [];
    $allFindings  = array_merge($smtpFindings, $sesFindings);
@endphp

@if(!empty($allFindings))
<div class="card">
    <div class="card-title">&#x26A0; Risk Findings ({{ count($allFindings) }})</div>

    @if(!empty($smtpFindings))
        <div style="font-size:11px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">
            SMTP / DNS Findings
        </div>
        <ul class="findings-list" style="margin-bottom:16px;">
            @foreach($smtpFindings as $finding)
                <li>{{ $finding }}</li>
            @endforeach
        </ul>
    @endif

    @if(!empty($sesFindings))
        <div style="font-size:11px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">
            SES / API Abuse Findings
        </div>
        <ul class="findings-list">
            @foreach($sesFindings as $finding)
                <li>{{ $finding }}</li>
            @endforeach
        </ul>
    @endif
</div>
@else
<div class="card" style="text-align:center;padding:32px;">
    <div style="font-size:24px;margin-bottom:8px;">&#10003;</div>
    <div style="color:var(--low);font-weight:600;">No significant risk findings detected</div>
    <div style="color:var(--text-dim);font-size:13px;margin-top:4px;">
        All analyzed signals appear within acceptable thresholds.
    </div>
</div>
@endif

{{-- Metadata / Infrastructure Details --}}
<div class="card">
    <div class="card-title">Infrastructure Metadata</div>
    <div class="detail-grid">
        <div class="detail-item">
            <label>Email Provider</label>
            <div class="value">{{ $asset->email_provider ?? '—' }}</div>
        </div>
        <div class="detail-item">
            <label>Daily Send Volume</label>
            <div class="value">
                {{ $asset->daily_send_volume !== null ? number_format($asset->daily_send_volume) : '—' }}
                @if($asset->baseline_volume)
                    <span style="color:var(--text-dim);font-size:12px;">
                        (baseline: {{ number_format($asset->baseline_volume) }})
                    </span>
                @endif
            </div>
        </div>
        <div class="detail-item">
            <label>PHP mail() in use</label>
            <div class="value">
                @if($asset->uses_php_mail)
                    <span style="color:var(--critical);">&#x2717; Yes — risk factor</span>
                @else
                    <span style="color:var(--text-dim);">No</span>
                @endif
            </div>
        </div>
        <div class="detail-item">
            <label>Laravel Queue Mail</label>
            <div class="value">
                @if($asset->uses_laravel_queue)
                    <span style="color:var(--medium);">&#x26A0; Yes</span>
                @else
                    <span style="color:var(--text-dim);">No</span>
                @endif
            </div>
        </div>
        <div class="detail-item">
            <label>Open Relay Indicator</label>
            <div class="value">
                @if($asset->open_relay_banner)
                    <span style="color:var(--critical);">&#x2717; Detected</span>
                @else
                    <span style="color:var(--text-dim);">Not detected</span>
                @endif
            </div>
        </div>
        <div class="detail-item">
            <label>API Key Exposed</label>
            <div class="value">
                @if($asset->has_api_key_exposed)
                    <span style="color:var(--critical);">&#x2717; Yes — critical</span>
                @else
                    <span style="color:var(--text-dim);">No</span>
                @endif
            </div>
        </div>
        @if(!empty($asset->reputation_signals))
        <div class="detail-item" style="grid-column:1/-1;">
            <label>Reputation Signals</label>
            <div class="value" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">
                @foreach($asset->reputation_signals as $signal)
                    <span class="badge badge-fail">{{ $signal }}</span>
                @endforeach
            </div>
        </div>
        @endif
    </div>
</div>

{{-- Remediation Guidance --}}
<div class="card">
    <div class="card-title">&#x1F6E1; Remediation Guidance</div>
    <div style="display:flex;flex-direction:column;gap:10px;">
        @if($asset->spf_status === 'missing')
        <div style="font-size:13px;">
            <strong style="color:var(--critical);">SPF Missing:</strong>
            Add a TXT record to DNS: <code style="background:var(--bg);padding:2px 6px;border-radius:3px;font-size:12px;">v=spf1 include:your-provider.com -all</code>
        </div>
        @endif
        @if($asset->dmarc_status === 'missing')
        <div style="font-size:13px;">
            <strong style="color:var(--critical);">DMARC Missing:</strong>
            Add to DNS: <code style="background:var(--bg);padding:2px 6px;border-radius:3px;font-size:12px;">_dmarc.{{ $asset->domain }} TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@{{ $asset->domain }}"</code>
        </div>
        @endif
        @if($asset->uses_php_mail)
        <div style="font-size:13px;">
            <strong style="color:var(--medium);">PHP mail() Abuse Risk:</strong>
            Replace with authenticated SMTP via Swift Mailer / PHPMailer / Laravel Mail with explicit credentials.
        </div>
        @endif
        @if($asset->open_relay_banner)
        <div style="font-size:13px;">
            <strong style="color:var(--critical);">Open Relay:</strong>
            Configure Postfix/Exim to require SASL authentication. Set <code style="background:var(--bg);padding:2px 6px;border-radius:3px;font-size:12px;">smtpd_relay_restrictions = permit_sasl_authenticated, reject</code>
        </div>
        @endif
        @if($asset->has_api_key_exposed)
        <div style="font-size:13px;">
            <strong style="color:var(--critical);">API Key Exposure:</strong>
            Immediately rotate all email API keys, audit sent messages in the last 30 days, and add IP allowlisting.
        </div>
        @endif
        @if($asset->dmarc_status === 'weak')
        <div style="font-size:13px;">
            <strong style="color:var(--medium);">DMARC p=none:</strong>
            Upgrade DMARC policy from <code style="background:var(--bg);padding:2px 6px;border-radius:3px;font-size:12px;">p=none</code> to <code style="background:var(--bg);padding:2px 6px;border-radius:3px;font-size:12px;">p=quarantine</code> or <code style="background:var(--bg);padding:2px 6px;border-radius:3px;font-size:12px;">p=reject</code> to enforce policy.
        </div>
        @endif
        @if($asset->risk_level === 'low' && empty($allFindings))
        <div style="font-size:13px;color:var(--text-dim);">
            Email infrastructure appears well-configured. Continue monitoring and maintain SPF/DMARC policies.
        </div>
        @endif
    </div>
</div>
@endsection
