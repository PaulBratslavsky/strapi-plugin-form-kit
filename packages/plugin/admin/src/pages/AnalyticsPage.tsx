import { useEffect, useMemo, useState } from 'react';
import {
  Main,
  Box,
  Typography,
  Button,
  Flex,
  Loader,
  SingleSelect,
  SingleSelectOption,
} from '@strapi/design-system';
import { ArrowLeft, Download } from '@strapi/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useFormsApi, type AnalyticsRange, type AnalyticsReport } from '../api';

const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;
const fmtDuration = (s: number | null) => {
  if (s === null) return '—';
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s % 60)}s`;
};

const StatCard = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <Box
    flex="1"
    hasRadius
    padding={4}
    background="neutral0"
    borderColor="neutral200"
    style={{ minWidth: 0 }}
  >
    <Typography variant="sigma" textColor="neutral600">
      {label}
    </Typography>
    <Box marginTop={1}>
      <Typography variant="alpha" tag="div">
        {value}
      </Typography>
    </Box>
    {hint && (
      <Typography variant="pi" textColor="neutral500">
        {hint}
      </Typography>
    )}
  </Box>
);

/** Dependency-free dual-line chart: views (light) overlaid with submits (dark). */
const TrendChart = ({ series }: { series: AnalyticsReport['series'] }) => {
  const w = 720;
  const h = 200;
  const pad = 24;
  const max = Math.max(1, ...series.map((d) => d.views));
  const n = series.length;
  const x = (i: number) => (n <= 1 ? pad : pad + (i * (w - 2 * pad)) / (n - 1));
  const y = (v: number) => h - pad - (v / max) * (h - 2 * pad);
  const path = (key: 'views' | 'submits') =>
    series.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`).join(' ');

  if (n === 0) {
    return (
      <Typography textColor="neutral600" variant="pi">
        No data in this range yet.
      </Typography>
    );
  }

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label="Views and submissions over time">
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#dcdce4" strokeWidth={1} />
      <path d={path('views')} fill="none" stroke="#a5a5ba" strokeWidth={2} />
      <path d={path('submits')} fill="none" stroke="#4945ff" strokeWidth={2} />
    </svg>
  );
};

const DropoffTable = ({ rows }: { rows: AnalyticsReport['dropoffByField'] }) => {
  if (rows.length === 0) {
    return (
      <Typography textColor="neutral600" variant="pi">
        No per-field drop-off recorded yet.
      </Typography>
    );
  }
  return (
    <Box>
      <Flex paddingBottom={2} borderColor="neutral200" style={{ borderBottom: '1px solid' }}>
        <Box flex="2">
          <Typography variant="sigma" textColor="neutral600">
            Field
          </Typography>
        </Box>
        <Box flex="1">
          <Typography variant="sigma" textColor="neutral600">
            Reached
          </Typography>
        </Box>
        <Box flex="1">
          <Typography variant="sigma" textColor="neutral600">
            Drop-off
          </Typography>
        </Box>
        <Box flex="1">
          <Typography variant="sigma" textColor="neutral600">
            Rate
          </Typography>
        </Box>
      </Flex>
      {rows.map((r) => (
        <Flex key={r.fieldId} paddingTop={2} paddingBottom={2} borderColor="neutral150" style={{ borderBottom: '1px solid' }}>
          <Box flex="2">
            <Typography variant="omega">{r.label ?? r.fieldId}</Typography>
          </Box>
          <Box flex="1">
            <Typography variant="omega">{r.reached}</Typography>
          </Box>
          <Box flex="1">
            <Typography variant="omega">{r.dropoff}</Typography>
          </Box>
          <Box flex="1">
            <Typography variant="omega" textColor={r.reached > 0 && r.dropoff / r.reached > 0.3 ? 'danger600' : 'neutral800'}>
              {r.reached > 0 ? fmtPct(r.dropoff / r.reached) : '—'}
            </Typography>
          </Box>
        </Flex>
      ))}
    </Box>
  );
};

export const AnalyticsPage = () => {
  const { documentId = '' } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const { getForm, getAnalytics, downloadAnalyticsCsv } = useFormsApi();

  const [range, setRange] = useState<AnalyticsRange>('30d');
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getForm(documentId), getAnalytics(documentId, range)])
      .then(([form, rep]) => {
        if (cancelled) return;
        setFormName(form?.name ?? '');
        setFormSlug(form?.slug ?? documentId);
        setReport(rep);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId, range, getForm, getAnalytics]);

  const totals = report?.totals;
  const subtitle = useMemo(
    () => (report ? `${report.range.from} → ${report.range.to}` : ''),
    [report]
  );

  return (
    <Main>
      <Box padding={6}>
        <Flex justifyContent="space-between" alignItems="center">
          <Flex gap={3} alignItems="center">
            <Button variant="tertiary" startIcon={<ArrowLeft />} onClick={() => navigate('..')}>
              Back to builder
            </Button>
            <Box>
              <Typography variant="alpha" tag="h1">
                Analytics{formName ? ` · ${formName}` : ''}
              </Typography>
              {subtitle && (
                <Typography variant="pi" textColor="neutral600" tag="div">
                  {subtitle}
                </Typography>
              )}
            </Box>
          </Flex>
          <Flex gap={2} alignItems="center">
            <Box style={{ width: 140 }}>
              <SingleSelect aria-label="Date range" value={range} onChange={(v: any) => setRange(v)}>
                <SingleSelectOption value="7d">Last 7 days</SingleSelectOption>
                <SingleSelectOption value="30d">Last 30 days</SingleSelectOption>
                <SingleSelectOption value="90d">Last 90 days</SingleSelectOption>
                <SingleSelectOption value="all">All time</SingleSelectOption>
              </SingleSelect>
            </Box>
            <Button
              variant="secondary"
              startIcon={<Download />}
              onClick={() =>
                downloadAnalyticsCsv(documentId, range, `analytics-${formSlug}-${range}.csv`)
              }
            >
              Export CSV
            </Button>
          </Flex>
        </Flex>

        {loading || !totals ? (
          <Flex justifyContent="center" padding={8}>
            <Loader />
          </Flex>
        ) : (
          <>
            <Flex gap={4} marginTop={5} alignItems="stretch">
              <StatCard label="Views" value={String(totals.views)} />
              <StatCard label="Starts" value={String(totals.starts)} />
              <StatCard label="Submissions" value={String(totals.submits)} />
              <StatCard label="Completion" value={fmtPct(totals.completionRate)} hint="submissions ÷ views" />
              <StatCard label="Avg. time" value={fmtDuration(totals.avgSeconds)} hint="start → submit" />
            </Flex>

            <Box
              marginTop={5}
              hasRadius
              padding={4}
              background="neutral0"
              borderColor="neutral200"
            >
              <Flex gap={4} alignItems="center" marginBottom={3}>
                <Typography variant="delta">Views & submissions</Typography>
                <Flex gap={2} alignItems="center">
                  <span style={{ width: 12, height: 2, background: '#a5a5ba', display: 'inline-block' }} />
                  <Typography variant="pi" textColor="neutral600">Views</Typography>
                </Flex>
                <Flex gap={2} alignItems="center">
                  <span style={{ width: 12, height: 2, background: '#4945ff', display: 'inline-block' }} />
                  <Typography variant="pi" textColor="neutral600">Submissions</Typography>
                </Flex>
              </Flex>
              <TrendChart series={report!.series} />
            </Box>

            <Box
              marginTop={5}
              hasRadius
              padding={4}
              background="neutral0"
              borderColor="neutral200"
            >
              <Box marginBottom={3}>
                <Typography variant="delta">Per-field drop-off</Typography>
              </Box>
              <DropoffTable rows={report!.dropoffByField} />
            </Box>
          </>
        )}
      </Box>
    </Main>
  );
};
