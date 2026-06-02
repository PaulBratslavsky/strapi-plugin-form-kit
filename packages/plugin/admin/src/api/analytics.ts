import { useCallback } from 'react';
import { useFetchClient } from '@strapi/strapi/admin';
import { PREFIX, readAdminJwt } from './shared';

export type AnalyticsRange = '7d' | '30d' | '90d' | 'all';

export type AnalyticsReport = {
  range: { from: string; to: string };
  totals: {
    views: number;
    starts: number;
    attempts: number;
    submits: number;
    completionRate: number;
    avgSeconds: number | null;
  };
  series: { day: string; views: number; submits: number }[];
  dropoffByField: { fieldId: string; label?: string; reached: number; dropoff: number }[];
};

export const useAnalyticsApi = () => {
  const { get } = useFetchClient();

  const getAnalytics = useCallback(
    async (formDocumentId: string, range: AnalyticsRange): Promise<AnalyticsReport> => {
      const r = await get(`${PREFIX}/forms/${formDocumentId}/analytics?range=${range}`);
      return r.data?.data;
    },
    [get]
  );

  /**
   * Fetch the CSV with the admin JWT (it lives in localStorage, not a cookie,
   * so a plain <a href> download wouldn't authenticate) and trigger a save.
   */
  const downloadAnalyticsCsv = useCallback(
    async (formDocumentId: string, range: AnalyticsRange, filename: string) => {
      const url = `${PREFIX}/forms/${formDocumentId}/analytics/export.csv?range=${range}`;
      const token = readAdminJwt();
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`CSV export failed (${res.status})`);
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    },
    []
  );

  return { getAnalytics, downloadAnalyticsCsv };
};
