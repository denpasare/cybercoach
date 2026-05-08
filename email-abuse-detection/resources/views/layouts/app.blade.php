<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>@yield('title', 'Email Abuse Detection System')</title>
    <style>
        /* ─── Reset & Base ─────────────────────────────────────── */
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
            --bg:         #0d1117;
            --bg-card:    #161b22;
            --bg-input:   #0d1117;
            --border:     #30363d;
            --text:       #c9d1d9;
            --text-dim:   #8b949e;
            --accent:     #58a6ff;
            --critical:   #ff4d4d;
            --high:       #f97316;
            --medium:     #eab308;
            --low:        #22c55e;
            --sidebar-w:  240px;
            --radius:     8px;
        }
        html, body { height: 100%; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg);
            color: var(--text);
            font-size: 14px;
            line-height: 1.6;
        }
        a { color: var(--accent); text-decoration: none; }
        a:hover { text-decoration: underline; }

        /* ─── Layout ────────────────────────────────────────────── */
        .layout { display: flex; min-height: 100vh; }

        /* Sidebar */
        .sidebar {
            width: var(--sidebar-w);
            background: var(--bg-card);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            padding: 0;
            position: fixed;
            top: 0; left: 0;
            height: 100vh;
            z-index: 100;
        }
        .sidebar-brand {
            padding: 20px 20px 16px;
            border-bottom: 1px solid var(--border);
        }
        .sidebar-brand h1 {
            font-size: 13px;
            font-weight: 700;
            color: var(--accent);
            letter-spacing: 0.05em;
            text-transform: uppercase;
            line-height: 1.3;
        }
        .sidebar-brand .tagline {
            font-size: 11px;
            color: var(--text-dim);
            margin-top: 2px;
        }
        .sidebar-nav { padding: 12px 0; flex: 1; }
        .sidebar-nav a {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 9px 20px;
            color: var(--text-dim);
            font-size: 13px;
            border-left: 3px solid transparent;
            transition: all 0.15s;
        }
        .sidebar-nav a:hover,
        .sidebar-nav a.active {
            color: var(--text);
            background: rgba(88,166,255,0.08);
            border-left-color: var(--accent);
            text-decoration: none;
        }
        .sidebar-nav .icon { font-size: 16px; width: 20px; text-align: center; }
        .sidebar-footer {
            padding: 16px 20px;
            border-top: 1px solid var(--border);
            font-size: 11px;
            color: var(--text-dim);
        }

        /* Main content */
        .main {
            margin-left: var(--sidebar-w);
            flex: 1;
            padding: 28px 32px;
            min-width: 0;
        }

        /* ─── Page Header ───────────────────────────────────────── */
        .page-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 24px;
        }
        .page-header h2 {
            font-size: 20px;
            font-weight: 600;
            color: var(--text);
        }
        .page-header .subtitle {
            font-size: 13px;
            color: var(--text-dim);
            margin-top: 2px;
        }

        /* ─── Cards ─────────────────────────────────────────────── */
        .card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 20px;
            margin-bottom: 20px;
        }
        .card-title {
            font-size: 12px;
            font-weight: 600;
            color: var(--text-dim);
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-bottom: 14px;
        }

        /* ─── Stats Grid ────────────────────────────────────────── */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }
        .stat-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 16px 20px;
            text-align: center;
        }
        .stat-card .stat-num {
            font-size: 28px;
            font-weight: 700;
            line-height: 1.1;
        }
        .stat-card .stat-label {
            font-size: 11px;
            color: var(--text-dim);
            text-transform: uppercase;
            letter-spacing: 0.06em;
            margin-top: 4px;
        }
        .stat-card.critical .stat-num { color: var(--critical); }
        .stat-card.high     .stat-num { color: var(--high); }
        .stat-card.medium   .stat-num { color: var(--medium); }
        .stat-card.low      .stat-num { color: var(--low); }
        .stat-card.total    .stat-num { color: var(--accent); }

        /* ─── Badges ────────────────────────────────────────────── */
        .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .badge-critical { background: rgba(255,77,77,0.15);  color: var(--critical); border: 1px solid rgba(255,77,77,0.3); }
        .badge-high     { background: rgba(249,115,22,0.15); color: var(--high);     border: 1px solid rgba(249,115,22,0.3); }
        .badge-medium   { background: rgba(234,179,8,0.15);  color: var(--medium);   border: 1px solid rgba(234,179,8,0.3); }
        .badge-low      { background: rgba(34,197,94,0.15);  color: var(--low);      border: 1px solid rgba(34,197,94,0.3); }
        .badge-pass     { background: rgba(34,197,94,0.15);  color: var(--low);      border: 1px solid rgba(34,197,94,0.3); }
        .badge-fail     { background: rgba(255,77,77,0.15);  color: var(--critical); border: 1px solid rgba(255,77,77,0.3); }
        .badge-missing  { background: rgba(249,115,22,0.15); color: var(--high);     border: 1px solid rgba(249,115,22,0.3); }
        .badge-weak     { background: rgba(234,179,8,0.15);  color: var(--medium);   border: 1px solid rgba(234,179,8,0.3); }
        .badge-valid    { background: rgba(34,197,94,0.15);  color: var(--low);      border: 1px solid rgba(34,197,94,0.3); }
        .badge-error    { background: rgba(139,148,158,0.15); color: var(--text-dim); border: 1px solid rgba(139,148,158,0.3); }
        .badge-unknown  { background: rgba(139,148,158,0.15); color: var(--text-dim); border: 1px solid rgba(139,148,158,0.3); }

        /* ─── Score Bar ─────────────────────────────────────────── */
        .score-bar-wrap { width: 120px; }
        .score-bar {
            height: 6px;
            background: var(--border);
            border-radius: 3px;
            overflow: hidden;
            margin-top: 4px;
        }
        .score-bar-fill {
            height: 100%;
            border-radius: 3px;
            transition: width 0.3s;
        }
        .score-val { font-size: 13px; font-weight: 600; }

        /* ─── Tables ────────────────────────────────────────────── */
        .table-wrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; }
        th {
            text-align: left;
            font-size: 11px;
            font-weight: 600;
            color: var(--text-dim);
            text-transform: uppercase;
            letter-spacing: 0.06em;
            padding: 8px 12px;
            border-bottom: 1px solid var(--border);
            white-space: nowrap;
        }
        td {
            padding: 10px 12px;
            border-bottom: 1px solid rgba(48,54,61,0.5);
            vertical-align: middle;
            font-size: 13px;
        }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: rgba(88,166,255,0.03); }
        .domain-cell { font-weight: 500; color: var(--text); }
        .domain-cell small { display: block; color: var(--text-dim); font-size: 11px; font-weight: 400; }

        /* ─── Forms ─────────────────────────────────────────────── */
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .form-grid.three { grid-template-columns: 1fr 1fr 1fr; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-group.full { grid-column: 1 / -1; }
        label {
            font-size: 12px;
            font-weight: 500;
            color: var(--text-dim);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        input[type=text], input[type=number], input[type=file],
        select, textarea {
            background: var(--bg-input);
            border: 1px solid var(--border);
            border-radius: 6px;
            color: var(--text);
            padding: 8px 12px;
            font-size: 13px;
            width: 100%;
            transition: border-color 0.15s;
        }
        input:focus, select:focus, textarea:focus {
            outline: none;
            border-color: var(--accent);
        }
        .checkbox-group {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 10px;
        }
        .checkbox-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: var(--text);
            cursor: pointer;
        }
        .checkbox-item input[type=checkbox] {
            width: 15px; height: 15px;
            accent-color: var(--accent);
            cursor: pointer;
        }
        .form-hint {
            font-size: 11px;
            color: var(--text-dim);
            margin-top: 2px;
        }
        .section-title {
            font-size: 12px;
            font-weight: 600;
            color: var(--text-dim);
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin: 20px 0 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--border);
        }

        /* ─── Buttons ───────────────────────────────────────────── */
        .btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            border: none;
            text-decoration: none;
            transition: opacity 0.15s, background 0.15s;
        }
        .btn:hover { opacity: 0.85; text-decoration: none; }
        .btn-primary  { background: var(--accent); color: #0d1117; }
        .btn-danger   { background: rgba(255,77,77,0.15); color: var(--critical); border: 1px solid rgba(255,77,77,0.3); }
        .btn-outline  { background: transparent; color: var(--text); border: 1px solid var(--border); }
        .btn-success  { background: rgba(34,197,94,0.15); color: var(--low); border: 1px solid rgba(34,197,94,0.3); }
        .btn-sm { padding: 4px 10px; font-size: 12px; }

        /* ─── Alerts ────────────────────────────────────────────── */
        .alert {
            padding: 12px 16px;
            border-radius: 6px;
            margin-bottom: 20px;
            font-size: 13px;
        }
        .alert-success { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); color: var(--low); }
        .alert-error   { background: rgba(255,77,77,0.1); border: 1px solid rgba(255,77,77,0.3); color: var(--critical); }

        /* ─── Filter Bar ────────────────────────────────────────── */
        .filter-bar {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            align-items: center;
            margin-bottom: 20px;
        }
        .filter-bar select,
        .filter-bar input {
            width: auto;
            min-width: 130px;
            padding: 6px 10px;
            font-size: 13px;
        }

        /* ─── Findings List ─────────────────────────────────────── */
        .findings-list {
            list-style: none;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .findings-list li {
            display: flex;
            gap: 10px;
            align-items: flex-start;
            font-size: 13px;
            color: var(--text);
        }
        .findings-list li::before {
            content: '⚠';
            color: var(--medium);
            flex-shrink: 0;
            margin-top: 1px;
        }

        /* ─── Score Meter ───────────────────────────────────────── */
        .score-meter {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .score-ring {
            width: 64px; height: 64px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            font-weight: 700;
            flex-shrink: 0;
        }
        .score-ring.critical { border: 3px solid var(--critical); color: var(--critical); }
        .score-ring.high     { border: 3px solid var(--high);     color: var(--high); }
        .score-ring.medium   { border: 3px solid var(--medium);   color: var(--medium); }
        .score-ring.low      { border: 3px solid var(--low);      color: var(--low); }

        /* ─── Pagination ────────────────────────────────────────── */
        .pagination { display: flex; gap: 6px; align-items: center; margin-top: 16px; }
        .pagination a, .pagination span {
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 12px;
            border: 1px solid var(--border);
            color: var(--text);
        }
        .pagination a:hover { background: var(--bg-card); text-decoration: none; }
        .pagination .active span {
            background: var(--accent);
            color: #0d1117;
            border-color: var(--accent);
        }

        /* ─── DNS Detail Grid ───────────────────────────────────── */
        .detail-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
        }
        .detail-item label {
            font-size: 11px;
            color: var(--text-dim);
            text-transform: uppercase;
            letter-spacing: 0.06em;
            margin-bottom: 4px;
            display: block;
        }
        .detail-item .value {
            font-size: 13px;
            color: var(--text);
            word-break: break-all;
        }
        .code-block {
            background: var(--bg);
            border: 1px solid var(--border);
            border-radius: 4px;
            padding: 10px 12px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            word-break: break-all;
            color: var(--text-dim);
        }

        /* ─── Tabs ──────────────────────────────────────────────── */
        .tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border); margin-bottom: 20px; }
        .tab {
            padding: 10px 18px;
            font-size: 13px;
            color: var(--text-dim);
            cursor: pointer;
            border-bottom: 2px solid transparent;
            margin-bottom: -1px;
        }
        .tab.active { color: var(--accent); border-bottom-color: var(--accent); }

        /* ─── Upload Card ───────────────────────────────────────── */
        .upload-zone {
            border: 2px dashed var(--border);
            border-radius: var(--radius);
            padding: 32px;
            text-align: center;
            transition: border-color 0.2s;
        }
        .upload-zone:hover { border-color: var(--accent); }
        .upload-zone .icon { font-size: 32px; margin-bottom: 10px; color: var(--text-dim); }
        .upload-zone .hint { font-size: 12px; color: var(--text-dim); margin-top: 6px; }

        /* ─── Responsive ────────────────────────────────────────── */
        @media (max-width: 900px) {
            .sidebar { display: none; }
            .main { margin-left: 0; padding: 20px 16px; }
            .form-grid { grid-template-columns: 1fr; }
            .detail-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
<div class="layout">
    <!-- Sidebar -->
    <nav class="sidebar">
        <div class="sidebar-brand">
            <h1>Email Abuse<br>Detection</h1>
            <div class="tagline">SMTP + SES Intelligence</div>
        </div>
        <div class="sidebar-nav">
            <a href="{{ route('dashboard') }}" class="{{ request()->routeIs('dashboard') ? 'active' : '' }}">
                <span class="icon">&#127760;</span> Dashboard
            </a>
            <a href="{{ route('analyze.create') }}" class="{{ request()->routeIs('analyze.*') ? 'active' : '' }}">
                <span class="icon">&#128269;</span> Analyze
            </a>
            <a href="{{ route('export') }}" target="_blank">
                <span class="icon">&#128229;</span> Export CSV
            </a>
        </div>
        <div class="sidebar-footer">
            v1.0 &bull; Passive Analysis Only<br>
            No active scanning
        </div>
    </nav>

    <!-- Main Content -->
    <main class="main">
        @if(session('success'))
            <div class="alert alert-success">{{ session('success') }}</div>
        @endif

        @if($errors->any())
            <div class="alert alert-error">
                @foreach($errors->all() as $error)
                    <div>{{ $error }}</div>
                @endforeach
            </div>
        @endif

        @yield('content')
    </main>
</div>
</body>
</html>
