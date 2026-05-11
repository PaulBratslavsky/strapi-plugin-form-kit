import { useState } from 'react';
import { Main, Box, Typography, Button, Flex, Field } from '@strapi/design-system';
import { useNavigate } from 'react-router-dom';
import { useFormsApi } from '../api';

export const NewForm = () => {
  const navigate = useNavigate();
  const { createForm } = useFormsApi();
  const [name, setName] = useState('Untitled form');
  const [slug, setSlug] = useState('untitled-form');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slugify = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

  const onCreate = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const created = await createForm({
        name,
        slug: slugify(slug || name),
        description: '',
      });
      navigate(`../forms/edit/${created.documentId}`);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create form');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Main>
      <Box padding={8}>
        <Typography variant="alpha" tag="h1">
          Create a new form
        </Typography>
        <Box marginTop={1} marginBottom={6}>
          <Typography variant="omega" textColor="neutral600">
            Name your form, then build it on the canvas — drag fields or use the AI panel.
          </Typography>
        </Box>

        <Box maxWidth="640px">
          <Box marginBottom={4}>
            <Field.Root name="name" hint="Internal name shown in the admin">
              <Field.Label>Name</Field.Label>
              <Field.Input
                value={name}
                onChange={(e: any) => {
                  setName(e.target.value);
                  setSlug(slugify(e.target.value));
                }}
              />
              <Field.Hint />
            </Field.Root>
          </Box>

          <Box marginBottom={4}>
            <Field.Root
              name="slug"
              hint="URL-safe identifier used in the public API (/api/forms/<slug>) and the embed snippet"
            >
              <Field.Label>Slug</Field.Label>
              <Field.Input
                value={slug}
                onChange={(e: any) => setSlug(e.target.value)}
              />
              <Field.Hint />
            </Field.Root>
          </Box>

          {error && (
            <Box marginBottom={4} padding={3} background="danger100" hasRadius>
              <Typography textColor="danger600">{error}</Typography>
            </Box>
          )}

          <Flex gap={2}>
            <Button onClick={onCreate} loading={submitting} disabled={!name || !slug}>
              Create form
            </Button>
            <Button variant="tertiary" onClick={() => navigate('..')}>
              Cancel
            </Button>
          </Flex>
        </Box>
      </Box>
    </Main>
  );
};
