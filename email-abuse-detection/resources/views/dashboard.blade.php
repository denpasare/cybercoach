@extends('layouts.app')

@section('title', 'Dashboard — Email Abuse Detection System')

@section('content')
<div class="page-header">
    <div>
        <h2>Email Risk Dashboard</h2>
        <div class="subtitle">Passive SMTP, SES, and DNS abuse intelligence</div>
    </div>
    <div style="display:flex;gap:10px;">
        <a href="{{ route('analyze.create') }}" class="btn btn-primary">+ Analyze Domain</a>
        <a href="{{ route('export', request()->query()) }}" class="btn btn-outline">&#8595; Export CSV</a>
    </div>
</div>

{{-- Stats --}}
<div class="stats-grid">
    <div class="stat-card total">
        <div class="stat-num">{{ $stats['total'] }}</div>
        <div class="stat-label">Total Domains</div>
    </div>
    <div class="stat-card critical">
        <div class="stat-num">{{ $stats['critical'] }}</div>
        <div class="stat-label">Critical</div>
    </div>
    <div class="stat-card high">
        <div class="stat-num">{{ $stats['high'] }}</div>
        <div class="stat-label">High Risk</div>
    </div>
    <div class="stat-card medium">
        <div class="stat-num">{{ $stats['medium'] }}</div>
        <div class="stat-label">Medium Risk</div>
    </div>
    <div class="stat-card low">
        <div class="stat-num">{{ $stats['low'] }}</div>
        <div class="stat-label">Low Risk</div>
    </div>
</div>

{{-- Filter Bar --}}
<form method="GET" action="{{ route('dashboard') }}" class="filter-bar">
    @if(request('run_id'))
        <input type="hidden" name="run_id" value="{{ request('run_id') }}">
    @endif

    <input type="text" name="search" placeholder="Search domain..." value="{{ request('search') }}">

    <select name="risk_level">
        <option value="">All Risk Levels</option>
        <option value="critical" @selected(request('risk_level') === 'critical')>Critical</option>
        <option value="high"     @selected(request('risk_level') === 'high')>High</option>
        <option value="medium"   @selected(request('risk_level') === 'medium')>Medium</option>
        <option value="low"      @selected(request('risk_level') === 'low')>Low</option>
    </select>

    <select name="smtp_min">
        <option value="">SMTP Risk — Any</option>
        <option value="20" @selected(request('smtp_min') == '20')>SMTP &ge; 20</option>
        <option value="40" @selected(request('smtp_min') == '40')>SMTP &ge; 40</option>
        <option value="60" @selected(request('smtp_min') == '60')>SMTP &ge; 60</option>
    </select>

    <select name="ses_min">
        <option value="">SES Risk — Any</option>
        <option value="20" @selected(request('ses_min') == '20')>SES &ge; 20</option>
        <option value="40" @selected(request('ses_min') == '40')>SES &ge; 40</option>
        <option value="60" @selected(request('ses_min') == '60')>SES &ge; 60</option>
    </select>

    @if($runs->isNotEmpty())
    <select name="run_id">
        <option value="">All Runs</option>
        @foreach($runs as $run)
            <option value="{{ $run->id }}" @selected(request('run_id') == $run->id)>
                {{ $run->name }} ({{ $run->created_at->format('M d, H:i') }})
            </option>
        @endforeach
    </select>
    @endif

    <button type="submit" class="btn btn-outline">Filter</button>
    @if(request()->hasAny(['search','risk_level','smtp_min','ses_min']))
        <a href="{{ route('dashboard') }}" class="btn btn-outline">Clear</a>
    @endif
</form>

{{-- Critical Abuse Candidates Banner --}}
@if($stats['critical'] > 0)
<div style="background:rgba(255,77,77,0.06);border:1px solid rgba(255,77,77,0.25);border-radius:8px;padding:12px 16px;margin-bottom:20px;display:flex;align-items:center;gap:12px;">
    <span style="font-size:20px;">&#x26A0;&#xFE0F;</span>
    <span style="font-size:13px;color:#ff4d4d;font-weight:600;">
        {{ $stats['critical'] }} Critical Abuse Candidate{{ $stats['critical'] !== 1 ? 's' : '' }} Detected
    </span>
    <a href="{{ route('dashboard', ['risk_level'=>'critical']) }}" class="btn btn-danger btn-sm">View Critical</a>
</div>
@endif

{{-- Asset Table --}}
<div class="card" style="padding:0;">
    <div class="table-wrap">
        <table>
            <thead>
                <tr>
                    <th>Domain</th>
                    <th>Risk Level</th>
                    <th>Total Score</th>
                    <th>SMTP</th>
                    <th>SES/API</th>
                    <th>DNS</th>
                    <th>SPF</th>
                    <th>DMARC</th>
                    <th>Provider</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                @forelse($assets as $asset)
                @php
                    $scoreColor = match($asset->risk_level) {
                        'critical' => '#ff4d4d',
                        'high'     => '#f97316',
                        'medium'   => '#eab308',
                        default    => '#22c55e',
                    };
                @endphp
                <tr>
                    <td>
                        <div class="domain-cell">
                            {{ $asset->domain }}
                            @if($asset->ip)
                                <small>{{ $asset->ip }}</small>
                            @endif
                        </div>
                    </td>
                    <td>
                        <span class="badge badge-{{ $asset->risk_level }}">{{ strtoupper($asset->risk_level) }}</span>
                    </td>
                    <td>
                        <div class="score-bar-wrap">
                            <span class="score-val" style="color:{{ $scoreColor }}">{{ $asset->risk_score }}</span>
                            <div class="score-bar">
                                <div class="score-bar-fill" style="width:{{ $asset->risk_score }}%;background:{{ $scoreColor }};"></div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span style="color:{{ $asset->smtp_risk_score >= 40 ? '#f97316' : ($asset->smtp_risk_score >= 20 ? '#eab308' : '#22c55e') }};font-weight:600;">
                            {{ $asset->smtp_risk_score }}
                        </span>
                    </td>
                    <td>
                        <span style="color:{{ $asset->ses_risk_score >= 40 ? '#f97316' : ($asset->ses_risk_score >= 20 ? '#eab308' : '#22c55e') }};font-weight:600;">
                            {{ $asset->ses_risk_score }}
                        </span>
                    </td>
                    <td>
                        <span style="color:{{ $asset->dns_risk_score >= 40 ? '#f97316' : ($asset->dns_risk_score >= 20 ? '#eab308' : '#22c55e') }};font-weight:600;">
                            {{ $asset->dns_risk_score }}
                        </span>
                    </td>
                    <td><span class="badge badge-{{ $asset->spf_status }}">{{ $asset->spf_status }}</span></td>
                    <td><span class="badge badge-{{ $asset->dmarc_status }}">{{ $asset->dmarc_status }}</span></td>
                    <td>
                        @if($asset->email_provider)
                            <span style="font-size:12px;color:var(--text-dim);">{{ $asset->email_provider }}</span>
                        @else
                            <span style="color:var(--border);">—</span>
                        @endif
                    </td>
                    <td>
                        <a href="{{ route('assets.show', $asset) }}" class="btn btn-outline btn-sm">View</a>
                    </td>
                </tr>
                @empty
                <tr>
                    <td colspan="10" style="text-align:center;padding:40px;color:var(--text-dim);">
                        No domains analyzed yet. <a href="{{ route('analyze.create') }}">Analyze a domain</a>
                    </td>
                </tr>
                @endforelse
            </tbody>
        </table>
    </div>
</div>

{{-- Pagination --}}
@if($assets->hasPages())
<div class="pagination">
    {{ $assets->links('pagination::simple-bootstrap-4') }}
</div>
@endif
@endsection
