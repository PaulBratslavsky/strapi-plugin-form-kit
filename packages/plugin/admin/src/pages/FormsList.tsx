import { useEffect, useState } from 'react';
import {
  Main,
  Box,
  Typography,
  Button,
  Flex,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  IconButton,
  Loader,
  EmptyStateLayout,
} from '@strapi/design-system';
import { Plus, Pencil, Trash, Duplicate, Eye } from '@strapi/icons';
import { useNavigate } from 'react-router-dom';
import { useFormsApi, type FormListEntry } from '../api';
import { EmbedCodeSnippet } from '../components/shared/EmbedCodeSnippet';

export const FormsList = () => {
  const navigate = useNavigate();
  const { listForms, deleteForm, duplicateForm } = useFormsApi();
  const [forms, setForms] = useState<FormListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSnippetFor, setShowSnippetFor] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await listForms();
      setForms(r);
    } catch (err) {
      console.error('[strapi-forms] failed to list forms', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onDelete = async (documentId: string) => {
    if (!window.confirm('Delete this form? Submissions are also deleted.')) return;
    await deleteForm(documentId);
    await load();
  };

  const onDuplicate = async (documentId: string) => {
    const copy = await duplicateForm(documentId);
    navigate(`forms/edit/${copy.documentId}`);
  };

  return (
    <Main>
      <Box padding={8}>
        <Flex justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="alpha" tag="h1">
              Forms
            </Typography>
            <Typography variant="omega" textColor="neutral600">
              Build, embed, and manage forms.
            </Typography>
          </Box>
          <Button startIcon={<Plus />} onClick={() => navigate('forms/new')}>
            Create new form
          </Button>
        </Flex>

        <Box marginTop={6}>
          {loading ? (
            <Flex justifyContent="center" padding={6}>
              <Loader />
            </Flex>
          ) : forms.length === 0 ? (
            <EmptyStateLayout
              icon={<Plus />}
              content="No forms yet."
              action={
                <Button onClick={() => navigate('forms/new')} startIcon={<Plus />}>
                  Create your first form
                </Button>
              }
            />
          ) : (
            <Table colCount={6} rowCount={forms.length}>
              <Thead>
                <Tr>
                  <Th>
                    <Typography variant="sigma">Name</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">Slug</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">Fields</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">Submissions (new / total)</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">Status</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">Actions</Typography>
                  </Th>
                </Tr>
              </Thead>
              <Tbody>
                {forms.map((f) => (
                  <Tr key={f.documentId}>
                    <Td>
                      <Typography fontWeight="bold">{f.name}</Typography>
                    </Td>
                    <Td>
                      <Typography textColor="neutral600">{f.slug}</Typography>
                    </Td>
                    <Td>
                      <Typography>{f.fieldCount}</Typography>
                    </Td>
                    <Td>
                      <Typography>
                        {f.newSubmissionCount} / {f.submissionCount}
                      </Typography>
                    </Td>
                    <Td>
                      <Typography textColor={f.publishedAt ? 'success600' : 'neutral600'}>
                        {f.publishedAt ? 'Published' : 'Draft'}
                      </Typography>
                    </Td>
                    <Td>
                      <Flex gap={2}>
                        <IconButton label="View submissions" onClick={() => navigate(`submissions/${f.documentId}`)}>
                          <Eye />
                        </IconButton>
                        <IconButton label="Edit" onClick={() => navigate(`forms/edit/${f.documentId}`)}>
                          <Pencil />
                        </IconButton>
                        <IconButton label="Duplicate" onClick={() => onDuplicate(f.documentId)}>
                          <Duplicate />
                        </IconButton>
                        <IconButton label="Delete" onClick={() => onDelete(f.documentId)}>
                          <Trash />
                        </IconButton>
                        <Button variant="tertiary" size="S" onClick={() => setShowSnippetFor(f.slug)}>
                          Embed
                        </Button>
                      </Flex>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </Box>

        {showSnippetFor && (
          <Box marginTop={6}>
            <Flex justifyContent="space-between" alignItems="center">
              <Typography variant="beta">Embed snippet for "{showSnippetFor}"</Typography>
              <Button variant="tertiary" size="S" onClick={() => setShowSnippetFor(null)}>
                Hide
              </Button>
            </Flex>
            <Box marginTop={3}>
              <EmbedCodeSnippet slug={showSnippetFor} />
            </Box>
          </Box>
        )}
      </Box>
    </Main>
  );
};
