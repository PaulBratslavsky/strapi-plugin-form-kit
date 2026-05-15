import { useEffect, useState } from 'react';
import {
  Main,
  Box,
  Typography,
  Button,
  Flex,
  Loader,
  Tabs,
  IconButton,
  Modal,
} from '@strapi/design-system';
import {
  ArrowLeft,
  Check,
  Cross,
  Cog,
  Eye,
  ArrowsCounterClockwise,
  ArrowClockwise,
  Sparkle,
  Code,
} from '@strapi/icons';
import { AiBuilderPanel } from '../components/ai/AiBuilderPanel';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { DragPreview } from '../components/builder/DragPreview';
import { useFormsApi } from '../api';
import {
  useFormSchemaState,
  defaultField,
  type FormDraft,
  type Field,
} from '../hooks/useFormSchema';
import {
  FieldPalette,
  isPaletteId,
  fieldTypeFromPaletteId,
} from '../components/builder/FieldPalette';
import { FormCanvas } from '../components/builder/FormCanvas';
import { FieldConfigPanel } from '../components/builder/FieldConfigPanel';
import { FormSettingsPanel } from '../components/builder/FormSettingsPanel';
import { EmbedCodeSnippet } from '../components/shared/EmbedCodeSnippet';
import { CopyAiPromptButton } from '../components/shared/CopyAiPromptButton';
import { FormPreview } from '../components/builder/FormPreview';
import { PreviewFrame } from '../components/builder/PreviewFrame';
import { StyleBuilder } from '../components/builder/StyleBuilder';
import {
  PageBg,
  Header,
  HeaderActions,
  Layout,
  PaletteCard,
  ConfigDrawer,
  DrawerHeader,
  SaveBar,
  AiDrawer,
  AiDrawerCloseBar,
  ErrorBanner,
  PublishedDot,
  DraftDot,
  ModeSwitcher,
  ModeButton,
} from './FormBuilder.styled';

export const FormBuilder = () => {
  const { documentId = '' } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const { getForm, updateForm, publishForm } = useFormsApi();

  const {
    state,
    init,
    addField,
    removeField,
    reorderFields,
    updateField,
    updateSettings,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useFormSchemaState();

  const [meta, setMeta] = useState<{
    name: string;
    slug: string;
    publishedAt?: string | null;
  } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'field' | 'settings'>('settings');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<
    | { kind: 'palette'; fieldType: string }
    | { kind: 'canvas'; field: Field }
    | null
  >(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'build' | 'style'>('build');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const form = await getForm(documentId);
        if (cancelled) return;
        setMeta({ name: form.name, slug: form.slug, publishedAt: form.publishedAt ?? null });
        const draft: FormDraft = (form.schema as FormDraft) ?? {
          schemaVersion: 1,
          fields: [],
          settings: {},
        };
        init(draft);
      } catch (err: any) {
        setError(err?.message ?? 'Failed to load form');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId, getForm, init]);

  // Keyboard shortcuts: Cmd/Ctrl+Z = undo, Cmd/Ctrl+Shift+Z (or Cmd/Ctrl+Y) = redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      // Don't steal undo from native input fields focused inside the page.
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;

      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // Open the config drawer to "field" tab when a field is selected.
  useEffect(() => {
    if (selectedId) setActiveTab('field');
  }, [selectedId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (typeof active.id === 'string' && isPaletteId(active.id)) {
      setActiveDrag({ kind: 'palette', fieldType: fieldTypeFromPaletteId(active.id) });
      return;
    }
    const field = state.fields.find((f) => f.id === active.id);
    if (field) {
      setActiveDrag({ kind: 'canvas', field });
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over) return;

    if (typeof active.id === 'string' && isPaletteId(active.id)) {
      const type = fieldTypeFromPaletteId(active.id);
      const newField = defaultField(type);
      const overId = String(over.id);
      const targetIndex =
        overId === 'form-canvas'
          ? state.fields.length
          : state.fields.findIndex((f) => f.id === overId);
      addField(newField, targetIndex >= 0 ? targetIndex : state.fields.length);
      setSelectedId(newField.id);
      return;
    }

    if (active.id !== over.id) {
      const fromIndex = state.fields.findIndex((f) => f.id === active.id);
      const toIndex = state.fields.findIndex((f) => f.id === over.id);
      if (fromIndex >= 0 && toIndex >= 0) {
        reorderFields(fromIndex, toIndex);
      }
    }
  };

  const onSave = async (publish: boolean = false) => {
    setSaving(true);
    setError(null);
    try {
      await updateForm(documentId, { schema: state });
      if (publish) {
        await publishForm(documentId, 'publish');
        const updated = await getForm(documentId);
        setMeta({
          name: updated.name,
          slug: updated.slug,
          publishedAt: updated.publishedAt ?? null,
        });
      }
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err: any) {
      const apiErr = err?.response?.data?.error;
      const detail = apiErr?.details?.errors;
      setError(
        detail
          ? `Validation failed: ${detail
              .map((e: any) => `${e.path}: ${e.message}`)
              .join('; ')}`
          : err?.message ?? 'Save failed'
      );
    } finally {
      setSaving(false);
    }
  };

  const selectedField = state.fields.find((f) => f.id === selectedId) as Field | undefined;
  const drawerOpen = activeTab !== 'settings' || !!selectedField;

  if (loading) {
    return (
      <Main>
        <Flex justifyContent="center" padding={10}>
          <Loader />
        </Flex>
      </Main>
    );
  }

  return (
    <Main>
      <PageBg>
        <Header>
          <Flex gap={3} alignItems="center">
            <Button
              variant="tertiary"
              startIcon={<ArrowLeft />}
              onClick={() => navigate('..')}
            >
              Back
            </Button>
            <Box>
              <Typography variant="beta">{meta?.name ?? '(loading)'}</Typography>
              <Box>
                <Typography variant="pi" textColor="neutral500">
                  /api/forms/{meta?.slug}
                  {meta?.publishedAt ? ' · Published' : ' · Draft'}
                </Typography>
              </Box>
            </Box>
          </Flex>
          <ModeSwitcher>
            <ModeButton
              type="button"
              $active={viewMode === 'build'}
              onClick={() => setViewMode('build')}
            >
              Build
            </ModeButton>
            <ModeButton
              type="button"
              $active={viewMode === 'style'}
              onClick={() => {
                setSelectedId(null);
                setViewMode('style');
              }}
            >
              Style
            </ModeButton>
          </ModeSwitcher>
          <HeaderActions>
            <IconButton
              label="Undo (Cmd+Z)"
              withTooltip
              disabled={!canUndo}
              onClick={() => undo()}
            >
              <ArrowsCounterClockwise />
            </IconButton>
            <IconButton
              label="Redo (Cmd+Shift+Z)"
              withTooltip
              disabled={!canRedo}
              onClick={() => redo()}
            >
              <ArrowClockwise />
            </IconButton>
            <Button
              variant="tertiary"
              startIcon={<Eye />}
              onClick={() => setPreviewOpen(true)}
            >
              Preview & test
            </Button>
            <Button
              variant="tertiary"
              startIcon={<Sparkle />}
              onClick={() => setAiOpen(true)}
            >
              AI
            </Button>
            <CopyAiPromptButton documentId={documentId} />
            <Button variant="tertiary" onClick={() => navigate('./notifications')}>
              Notifications
            </Button>
            <Button variant="tertiary" onClick={() => navigate('./webhooks')}>
              Webhooks
            </Button>
            <Button variant="tertiary" startIcon={<Code />} onClick={() => setShareOpen(true)}>
              Share
            </Button>
            <IconButton
              label={activeTab === 'settings' ? 'Hide settings' : 'Form settings'}
              withTooltip
              onClick={() => {
                setSelectedId(null);
                setActiveTab(activeTab === 'settings' ? 'field' : 'settings');
              }}
            >
              <Cog />
            </IconButton>
          </HeaderActions>
        </Header>

        {error && <ErrorBanner>{error}</ErrorBanner>}

        {viewMode === 'style' && (
          <StyleBuilder
            schema={state}
            publicSubmitUrl={
              meta?.slug
                ? `${window.location.origin}/api/forms/${meta.slug}/submit`
                : undefined
            }
            publishedAt={meta?.publishedAt ?? null}
            baseUrl={meta?.slug ? `https://your-site.com/forms/${meta.slug}` : undefined}
            onThemeChange={(theme) => updateSettings({ theme })}
            onFieldChange={(id, patch) => updateField(id, patch)}
            onSettingsChange={(patch) => updateSettings(patch)}
          />
        )}

        {viewMode === 'build' && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveDrag(null)}
        >
          <Layout $hasDrawer={drawerOpen}>
            <PaletteCard>
              <FieldPalette />
            </PaletteCard>

            <Box>
              <FormCanvas
                fields={state.fields}
                selectedId={selectedId}
                onSelect={(id) => {
                  setSelectedId(id);
                  setActiveTab('field');
                }}
                onRemove={(id) => {
                  removeField(id);
                  if (selectedId === id) setSelectedId(null);
                }}
              />
            </Box>

            {drawerOpen && (
              <ConfigDrawer $open={drawerOpen}>
                <DrawerHeader>
                  <Tabs.Root
                    value={activeTab}
                    onValueChange={(v: any) => setActiveTab(v)}
                  >
                    <Tabs.List>
                      <Tabs.Trigger value="field" disabled={!selectedField}>
                        Field
                      </Tabs.Trigger>
                      <Tabs.Trigger value="settings">Form</Tabs.Trigger>
                    </Tabs.List>
                  </Tabs.Root>
                  <IconButton
                    label="Close"
                    withTooltip
                    variant="ghost"
                    onClick={() => {
                      setSelectedId(null);
                      setActiveTab('settings');
                    }}
                  >
                    <Cross />
                  </IconButton>
                </DrawerHeader>
                <Box padding={0}>
                  {activeTab === 'field' && selectedField && (
                    <FieldConfigPanel
                      field={selectedField}
                      onChange={(patch) => updateField(selectedField.id, patch)}
                    />
                  )}
                  {activeTab === 'settings' && (
                    <FormSettingsPanel
                      settings={state.settings}
                      onChange={updateSettings}
                    />
                  )}
                </Box>
              </ConfigDrawer>
            )}
          </Layout>

          <DragOverlay dropAnimation={{ duration: 180 }}>
            {activeDrag ? <DragPreview drag={activeDrag} /> : null}
          </DragOverlay>
        </DndContext>
        )}

        <AiDrawer $open={aiOpen} aria-hidden={!aiOpen}>
          <AiDrawerCloseBar>
            <IconButton
              label="Close AI panel"
              withTooltip
              variant="ghost"
              onClick={() => setAiOpen(false)}
            >
              <Cross />
            </IconButton>
          </AiDrawerCloseBar>
          {aiOpen && (
            <AiBuilderPanel
              target={viewMode === 'style' ? 'style' : 'layout'}
              mode={state.fields.length === 0 ? 'generate' : 'refine'}
              currentSchema={state.fields.length === 0 ? undefined : state}
              currentTheme={state.settings?.theme}
              onSchemaReady={(schema) => {
                init({
                  schemaVersion: schema?.schemaVersion ?? 1,
                  fields: schema?.fields ?? [],
                  settings: { ...state.settings, ...(schema?.settings ?? {}) },
                });
                // Keep the drawer open so the user sees the summary bubble
                // and can immediately ask for a refinement.
                setSelectedId(null);
              }}
              onThemeReady={(themePatch) => {
                // Style AI returns a partial ThemeConfig — merge over current.
                updateSettings({
                  theme: { ...(state.settings?.theme ?? { preset: 'clean' }), ...themePatch },
                });
              }}
            />
          )}
        </AiDrawer>

        <Modal.Root open={shareOpen} onOpenChange={setShareOpen}>
          <Modal.Content style={{ maxWidth: '720px' }}>
            <Modal.Header>
              <Modal.Title>Share / embed — {meta?.name ?? 'Form'}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <EmbedCodeSnippet slug={meta?.slug ?? ''} documentId={documentId} />
              {!meta?.publishedAt && (
                <Box marginTop={3} padding={3} background="warning100" hasRadius>
                  <Typography variant="pi" textColor="warning700">
                    This form isn't published yet. The embed snippet can only
                    fetch its schema once the form is live — publish before
                    pasting the snippet anywhere.
                  </Typography>
                </Box>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onClick={() => setShareOpen(false)}>
                Close
              </Button>
            </Modal.Footer>
          </Modal.Content>
        </Modal.Root>

        <Modal.Root open={previewOpen} onOpenChange={setPreviewOpen}>
          <Modal.Content style={{ maxWidth: '900px' }}>
            <Modal.Header>
              <Modal.Title>Preview & test — {meta?.name ?? 'Form'}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <PreviewFrame
                schema={state}
                publicSubmitUrl={
                  meta?.slug
                    ? `${window.location.origin}/api/forms/${meta.slug}/submit`
                    : undefined
                }
                publishedAt={meta?.publishedAt ?? null}
                baseUrl={meta?.slug ? `https://your-site.com/forms/${meta.slug}` : undefined}
              />
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onClick={() => setPreviewOpen(false)}>
                Close
              </Button>
            </Modal.Footer>
          </Modal.Content>
        </Modal.Root>

        <SaveBar>
          <Flex gap={2} alignItems="center">
            {meta?.publishedAt ? (
              <PublishedDot title={`Published · ${new Date(meta.publishedAt).toLocaleString()}`} />
            ) : (
              <DraftDot />
            )}
            <Typography variant="pi" textColor="neutral600">
              {meta?.publishedAt ? 'Published' : 'Draft'}
              {savedAt && ` · saved at ${savedAt}`}
            </Typography>
          </Flex>
          <Flex gap={2}>
            {meta?.publishedAt ? (
              <>
                <Button
                  variant="danger-light"
                  loading={saving}
                  onClick={async () => {
                    if (!window.confirm('Unpublish this form? It will stop accepting submissions until published again.')) return;
                    setSaving(true);
                    try {
                      await publishForm(documentId, 'unpublish');
                      const updated = await getForm(documentId);
                      setMeta({ name: updated.name, slug: updated.slug, publishedAt: updated.publishedAt ?? null });
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  Unpublish
                </Button>
                <Button startIcon={<Check />} loading={saving} onClick={() => onSave(true)}>
                  Save changes
                </Button>
              </>
            ) : (
              <>
                <Button variant="tertiary" loading={saving} onClick={() => onSave(false)}>
                  Save draft
                </Button>
                <Button startIcon={<Check />} loading={saving} onClick={() => onSave(true)}>
                  Save & publish
                </Button>
              </>
            )}
          </Flex>
        </SaveBar>
      </PageBg>
    </Main>
  );
};
