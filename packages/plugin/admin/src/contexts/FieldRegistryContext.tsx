import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useFormsApi, type FieldTypeEntry } from '../api';

type FieldRegistryContextValue = {
  fieldTypes: FieldTypeEntry[];
  loading: boolean;
  error: string | null;
};

const Ctx = createContext<FieldRegistryContextValue>({
  fieldTypes: [],
  loading: true,
  error: null,
});

export const FieldRegistryProvider = ({ children }: { children: ReactNode }) => {
  const { listFieldTypes } = useFormsApi();
  const [fieldTypes, setFieldTypes] = useState<FieldTypeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listFieldTypes()
      .then((r) => {
        if (!cancelled) {
          setFieldTypes(r);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message ?? 'Failed to load field types');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [listFieldTypes]);

  return <Ctx.Provider value={{ fieldTypes, loading, error }}>{children}</Ctx.Provider>;
};

export const useFieldRegistry = () => useContext(Ctx);
