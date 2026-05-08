@extends('layouts.app')

@section('title', 'Analyze — Email Abuse Detection System')

@section('content')
<div class="page-header">
    <div>
        <h2>Analyze Email Infrastructure</h2>
        <div class="subtitle">Passive DNS lookup &amp; metadata-based risk scoring — no active scanning</div>
    </div>
    <a href="{{ route('dashboard') }}" class="btn btn-outline">&#8592; Dashboard</a>
</div>

{{-- Tab toggles --}}
<div class="tabs" id="analysis-tabs">
    <div class="tab active" onclick="showTab('single', this)">Single Domain</div>
    <div class="tab" onclick="showTab('batch', this)">CSV Batch Upload</div>
</div>

{{-- ═══ Single Domain Form ══════════════════════════════════════ --}}
<div id="tab-single">
    <form method="POST" action="{{ route('analyze.single') }}">
        @csrf

        {{-- Basic Info --}}
        <div class="card">
            <div class="card-title">Target Domain</div>
            <div class="form-grid">
                <div class="form-group">
                    <label for="domain">Domain *</label>
                    <input type="text" name="domain" id="domain" placeholder="example.com"
                           value="{{ old('domain') }}" required>
                    <div class="form-hint">Root domain without protocol (e.g. example.com)</div>
                </div>
                <div class="form-group">
                    <label for="ip_address">IP Address (optional)</label>
                    <input type="text" name="ip_address" id="ip_address"
                           placeholder="192.168.1.1" value="{{ old('ip_address') }}">
                </div>
            </div>
        </div>

        {{-- Email Provider & Volume --}}
        <div class="card">
            <div class="card-title">Sending Infrastructure Metadata</div>
            <div class="form-grid three">
                <div class="form-group">
                    <label for="email_provider">Email Provider</label>
                    <select name="email_provider" id="email_provider">
                        <option value="">Unknown / Not provided</option>
                        <option value="ses"       @selected(old('email_provider') === 'ses')>AWS SES</option>
                        <option value="sendgrid"  @selected(old('email_provider') === 'sendgrid')>SendGrid</option>
                        <option value="mailgun"   @selected(old('email_provider') === 'mailgun')>Mailgun</option>
                        <option value="postmark"  @selected(old('email_provider') === 'postmark')>Postmark</option>
                        <option value="sparkpost" @selected(old('email_provider') === 'sparkpost')>SparkPost</option>
                        <option value="mandrill"  @selected(old('email_provider') === 'mandrill')>Mandrill</option>
                        <option value="brevo"     @selected(old('email_provider') === 'brevo')>Brevo/Sendinblue</option>
                        <option value="smtp"      @selected(old('email_provider') === 'smtp')>Self-hosted SMTP</option>
                        <option value="other"     @selected(old('email_provider') === 'other')>Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="daily_send_volume">Daily Send Volume</label>
                    <input type="number" name="daily_send_volume" id="daily_send_volume"
                           placeholder="e.g. 5000" min="0" value="{{ old('daily_send_volume') }}">
                    <div class="form-hint">Current daily email volume</div>
                </div>
                <div class="form-group">
                    <label for="baseline_volume">Baseline Volume</label>
                    <input type="number" name="baseline_volume" id="baseline_volume"
                           placeholder="e.g. 500" min="0" value="{{ old('baseline_volume') }}">
                    <div class="form-hint">Normal daily volume for spike comparison</div>
                </div>
            </div>

            <div class="section-title">Reputation Signals</div>
            <div class="form-group">
                <label for="reputation_signals">Known Reputation Issues</label>
                <input type="text" name="reputation_signals" id="reputation_signals"
                       placeholder="blacklist, spam, bounces, suspended, rbl"
                       value="{{ old('reputation_signals') }}">
                <div class="form-hint">Comma-separated keywords from any external reputation data</div>
            </div>
        </div>

        {{-- Risk Flags --}}
        <div class="card">
            <div class="card-title">SMTP Risk Flags</div>
            <div class="checkbox-group">
                <label class="checkbox-item">
                    <input type="checkbox" name="uses_php_mail" value="1" {{ old('uses_php_mail') ? 'checked' : '' }}>
                    PHP mail() in use
                </label>
                <label class="checkbox-item">
                    <input type="checkbox" name="uses_laravel_queue" value="1" {{ old('uses_laravel_queue') ? 'checked' : '' }}>
                    Laravel queue mail
                </label>
                <label class="checkbox-item">
                    <input type="checkbox" name="open_relay_banner" value="1" {{ old('open_relay_banner') ? 'checked' : '' }}>
                    Open relay indicator in banner
                </label>
                <label class="checkbox-item">
                    <input type="checkbox" name="exposed_smtp" value="1" {{ old('exposed_smtp') ? 'checked' : '' }}>
                    Exposed SMTP endpoint
                </label>
            </div>

            <div class="section-title">SES / API Risk Flags</div>
            <div class="checkbox-group">
                <label class="checkbox-item">
                    <input type="checkbox" name="has_api_key_exposed" value="1" {{ old('has_api_key_exposed') ? 'checked' : '' }}>
                    API key potentially exposed
                </label>
                <label class="checkbox-item">
                    <input type="checkbox" name="sudden_volume_spike" value="1" {{ old('sudden_volume_spike') ? 'checked' : '' }}>
                    Sudden volume spike reported
                </label>
                <label class="checkbox-item">
                    <input type="checkbox" name="no_bounce_handling" value="1" {{ old('no_bounce_handling') ? 'checked' : '' }}>
                    No bounce/complaint handling
                </label>
                <label class="checkbox-item">
                    <input type="checkbox" name="unverified_sending_domain" value="1" {{ old('unverified_sending_domain') ? 'checked' : '' }}>
                    Unverified sending domain in ESP
                </label>
            </div>
        </div>

        <button type="submit" class="btn btn-primary" style="font-size:14px;padding:10px 24px;">
            &#128269; Run Analysis
        </button>
    </form>
</div>

{{-- ═══ CSV Batch Upload Form ═══════════════════════════════════ --}}
<div id="tab-batch" style="display:none;">
    <div class="card">
        <div class="card-title">CSV Format Guide</div>
        <p style="font-size:13px;color:var(--text-dim);margin-bottom:12px;">
            Upload a CSV with the following columns. Only <strong>domain</strong> is required.
        </p>
        <div class="code-block">
domain,ip,email_provider,daily_send_volume,baseline_volume,uses_php_mail,uses_laravel_queue,open_relay_banner,has_api_key_exposed,reputation_signals
example.com,1.2.3.4,ses,10000,1000,no,no,no,no,"blacklist|spam"
test.org,,sendgrid,500,,yes,no,no,no,
        </div>
        <div class="form-hint" style="margin-top:8px;">
            Boolean columns accept: yes/no, 1/0, true/false. Reputation signals separated by | (pipe).
        </div>
    </div>

    <form method="POST" action="{{ route('analyze.batch') }}" enctype="multipart/form-data">
        @csrf
        <div class="card">
            <div class="card-title">Upload CSV</div>
            <div class="form-grid">
                <div class="form-group">
                    <label for="run_name">Analysis Run Name (optional)</label>
                    <input type="text" name="run_name" id="run_name"
                           placeholder="e.g. Q1 2026 SME Audit"
                           value="{{ old('run_name') }}">
                </div>
                <div class="form-group" style="align-items:flex-start;">
                    <label>&nbsp;</label>
                </div>
            </div>
            <div class="upload-zone">
                <div class="icon">&#128196;</div>
                <div>
                    <input type="file" name="csv_file" id="csv_file" accept=".csv,.txt" required>
                </div>
                <div class="hint">CSV files only, max 2MB</div>
            </div>
        </div>

        <button type="submit" class="btn btn-primary" style="font-size:14px;padding:10px 24px;">
            &#8679; Upload &amp; Analyze Batch
        </button>
    </form>
</div>

<script>
function showTab(name, el) {
    document.getElementById('tab-single').style.display = name === 'single' ? '' : 'none';
    document.getElementById('tab-batch').style.display  = name === 'batch'  ? '' : 'none';
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
}
</script>
@endsection
