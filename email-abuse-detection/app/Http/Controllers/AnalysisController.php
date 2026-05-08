<?php

namespace App\Http\Controllers;

use App\Services\EmailAbuseAnalyzer;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class AnalysisController extends Controller
{
    public function __construct(
        private readonly EmailAbuseAnalyzer $analyzer
    ) {}

    /**
     * Show the analysis / upload form.
     */
    public function create(): View
    {
        return view('analysis.create');
    }

    /**
     * Handle single domain analysis form submission.
     */
    public function storeSingle(Request $request): RedirectResponse
    {
        $request->validate([
            'domain'             => ['required', 'string', 'regex:/^[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,}$/'],
            'ip'                 => ['nullable', 'ip'],
            'email_provider'     => ['nullable', 'string', 'max:50'],
            'daily_send_volume'  => ['nullable', 'integer', 'min:0'],
            'baseline_volume'    => ['nullable', 'integer', 'min:0'],
            'reputation_signals' => ['nullable', 'string'],
        ]);

        $metadata = [
            'ip'                  => $request->ip_address,
            'email_provider'      => $request->email_provider,
            'daily_send_volume'   => $request->daily_send_volume,
            'baseline_volume'     => $request->baseline_volume,
            'uses_php_mail'       => $request->boolean('uses_php_mail'),
            'uses_laravel_queue'  => $request->boolean('uses_laravel_queue'),
            'open_relay_banner'   => $request->boolean('open_relay_banner'),
            'has_api_key_exposed' => $request->boolean('has_api_key_exposed'),
            'exposed_smtp'        => $request->boolean('exposed_smtp'),
            'sudden_volume_spike' => $request->boolean('sudden_volume_spike'),
            'no_bounce_handling'  => $request->boolean('no_bounce_handling'),
            'reputation_signals'  => $request->filled('reputation_signals')
                ? array_filter(array_map('trim', explode(',', $request->reputation_signals)))
                : [],
        ];

        $asset = $this->analyzer->analyzeDomain($request->domain, $metadata);

        return redirect()->route('assets.show', $asset)
            ->with('success', "Analysis complete for {$asset->domain}");
    }

    /**
     * Handle CSV batch upload.
     */
    public function storeBatch(Request $request): RedirectResponse
    {
        $request->validate([
            'csv_file'   => ['required', 'file', 'mimes:csv,txt', 'max:2048'],
            'run_name'   => ['nullable', 'string', 'max:100'],
        ]);

        $rows = $this->parseCsv($request->file('csv_file')->getPathname());

        if (empty($rows)) {
            return back()->withErrors(['csv_file' => 'No valid rows found in CSV file.']);
        }

        $run = $this->analyzer->analyzeBatch($rows, $request->run_name ?? '');

        return redirect()->route('dashboard', ['run_id' => $run->id])
            ->with('success', "Batch analysis complete. Analyzed {$run->total_domains} domains.");
    }

    /**
     * Parse a CSV file into an array of domain rows with optional metadata.
     *
     * Expected columns (first row = header):
     *   domain, ip, email_provider, daily_send_volume, baseline_volume,
     *   uses_php_mail, uses_laravel_queue, open_relay_banner,
     *   has_api_key_exposed, reputation_signals
     */
    private function parseCsv(string $path): array
    {
        $rows    = [];
        $handle  = fopen($path, 'r');

        if ($handle === false) {
            return [];
        }

        $headers = null;

        while (($line = fgetcsv($handle)) !== false) {
            if ($headers === null) {
                $headers = array_map('trim', array_map('strtolower', $line));
                continue;
            }

            if (count($line) < count($headers)) {
                $line = array_pad($line, count($headers), '');
            }

            $row = array_combine($headers, array_map('trim', $line));

            if (empty($row['domain'])) {
                continue;
            }

            // Normalize boolean-ish fields
            foreach (['uses_php_mail', 'uses_laravel_queue', 'open_relay_banner', 'has_api_key_exposed'] as $flag) {
                if (isset($row[$flag])) {
                    $row[$flag] = in_array(strtolower($row[$flag]), ['1', 'yes', 'true', 'y']);
                }
            }

            // Reputation signals as array
            if (isset($row['reputation_signals'])) {
                $row['reputation_signals'] = array_filter(
                    array_map('trim', explode('|', $row['reputation_signals']))
                );
            }

            $rows[] = $row;
        }

        fclose($handle);

        return $rows;
    }
}
