<?php

namespace App\Http\Controllers;

use App\Models\AnalysisRun;
use App\Models\EmailRiskAsset;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

class DashboardController extends Controller
{
    public function index(Request $request): View
    {
        $query = EmailRiskAsset::query()->with('analysisRun');

        // Filters
        if ($request->filled('risk_level')) {
            $query->where('risk_level', $request->risk_level);
        }

        if ($request->filled('smtp_min')) {
            $query->where('smtp_risk_score', '>=', (int) $request->smtp_min);
        }

        if ($request->filled('ses_min')) {
            $query->where('ses_risk_score', '>=', (int) $request->ses_min);
        }

        if ($request->filled('run_id')) {
            $query->where('analysis_run_id', (int) $request->run_id);
        }

        if ($request->filled('search')) {
            $query->where('domain', 'like', '%' . $request->search . '%');
        }

        $assets = $query->orderByDesc('risk_score')->paginate(25)->withQueryString();

        $stats = [
            'total'    => EmailRiskAsset::count(),
            'critical' => EmailRiskAsset::where('risk_level', 'critical')->count(),
            'high'     => EmailRiskAsset::where('risk_level', 'high')->count(),
            'medium'   => EmailRiskAsset::where('risk_level', 'medium')->count(),
            'low'      => EmailRiskAsset::where('risk_level', 'low')->count(),
        ];

        $runs = AnalysisRun::orderByDesc('created_at')->get(['id', 'name', 'created_at']);

        return view('dashboard', compact('assets', 'stats', 'runs'));
    }

    public function show(EmailRiskAsset $asset): View
    {
        return view('asset.show', compact('asset'));
    }

    public function export(Request $request)
    {
        $query = EmailRiskAsset::query();

        if ($request->filled('risk_level')) {
            $query->where('risk_level', $request->risk_level);
        }
        if ($request->filled('run_id')) {
            $query->where('analysis_run_id', (int) $request->run_id);
        }

        $assets = $query->orderByDesc('risk_score')->get();

        $filename = 'email-risk-export-' . now()->format('Y-m-d-His') . '.csv';

        $headers = [
            'Content-Type'        => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $callback = function () use ($assets) {
            $handle = fopen('php://output', 'w');

            fputcsv($handle, [
                'Domain', 'IP', 'Risk Level', 'Risk Score',
                'SMTP Score', 'SES Score', 'DNS Score',
                'SPF Status', 'DMARC Status', 'MX Status',
                'Email Provider', 'PHP Mail', 'Laravel Queue',
                'Open Relay Banner', 'API Key Exposed',
                'Daily Volume', 'Baseline Volume',
                'SMTP Findings', 'SES Findings',
                'Created At',
            ]);

            foreach ($assets as $a) {
                fputcsv($handle, [
                    $a->domain,
                    $a->ip ?? '',
                    $a->risk_level,
                    $a->risk_score,
                    $a->smtp_risk_score,
                    $a->ses_risk_score,
                    $a->dns_risk_score,
                    $a->spf_status,
                    $a->dmarc_status,
                    $a->mx_status,
                    $a->email_provider ?? '',
                    $a->uses_php_mail ? 'yes' : 'no',
                    $a->uses_laravel_queue ? 'yes' : 'no',
                    $a->open_relay_banner ? 'yes' : 'no',
                    $a->has_api_key_exposed ? 'yes' : 'no',
                    $a->daily_send_volume ?? '',
                    $a->baseline_volume ?? '',
                    implode('; ', $a->smtp_findings ?? []),
                    implode('; ', $a->ses_findings ?? []),
                    $a->created_at->toDateTimeString(),
                ]);
            }

            fclose($handle);
        };

        return response()->stream($callback, 200, $headers);
    }

    public function destroy(EmailRiskAsset $asset): RedirectResponse
    {
        $asset->delete();
        return redirect()->route('dashboard')->with('success', 'Asset deleted.');
    }
}
