/**
 * options-source-resolver.ts turns collection-backed choice fields into
 * concrete { label, value } rows. A fake `strapi.documents()` lets us
 * cover the happy path, soft-fail, and projection logic without a DB.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  resolveOptionsSources,
  resolveOneOptionSource,
} from './options-source-resolver';

const makeStrapi = (rows: any[] | Error) => {
  const findMany = vi.fn(async () => {
    if (rows instanceof Error) throw rows;
    return rows;
  });
  return {
    strapi: {
      documents: () => ({ findMany }),
      log: { warn: vi.fn() },
    } as any,
    findMany,
  };
};

describe('resolveOneOptionSource', () => {
  it('projects rows to { label, value } using the configured fields', async () => {
    const { strapi } = makeStrapi([
      { documentId: 'd1', title: 'Strapi Conf', location: 'Paris' },
      { documentId: 'd2', title: 'Plugin Meetup', location: 'Online' },
    ]);

    const out = await resolveOneOptionSource(strapi, {
      kind: 'collection',
      uid: 'api::event.event',
      labelField: 'title',
      valueField: 'documentId',
    });

    expect(out).toEqual([
      { label: 'Strapi Conf', value: 'd1' },
      { label: 'Plugin Meetup', value: 'd2' },
    ]);
  });

  it('defaults valueField to documentId when not given', async () => {
    const { strapi } = makeStrapi([{ documentId: 'abc', title: 'X' }]);
    const out = await resolveOneOptionSource(strapi, {
      kind: 'collection',
      uid: 'api::event.event',
      labelField: 'title',
    } as any);
    expect(out).toEqual([{ label: 'X', value: 'abc' }]);
  });

  it('only requests published entries', async () => {
    const { strapi, findMany } = makeStrapi([]);
    await resolveOneOptionSource(strapi, {
      kind: 'collection',
      uid: 'api::event.event',
      labelField: 'title',
    } as any);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'published' })
    );
  });

  it('drops rows missing the label or value field', async () => {
    const { strapi } = makeStrapi([
      { documentId: 'd1', title: 'Good' },
      { documentId: 'd2' }, // no title
      { title: 'No id' }, // no documentId
    ]);
    const out = await resolveOneOptionSource(strapi, {
      kind: 'collection',
      uid: 'api::event.event',
      labelField: 'title',
      valueField: 'documentId',
    });
    expect(out).toEqual([{ label: 'Good', value: 'd1' }]);
  });

  it('soft-fails to [] and logs a warning when the query throws', async () => {
    const { strapi } = makeStrapi(new Error('collection blew up'));
    const out = await resolveOneOptionSource(strapi, {
      kind: 'collection',
      uid: 'api::missing.missing',
      labelField: 'title',
    } as any);
    expect(out).toEqual([]);
    expect((strapi.log.warn as any)).toHaveBeenCalled();
  });
});

describe('resolveOptionsSources (whole schema)', () => {
  it('returns the schema untouched when there are no fields', async () => {
    const { strapi } = makeStrapi([]);
    expect(await resolveOptionsSources(strapi, null)).toBeNull();
    expect(await resolveOptionsSources(strapi, {})).toEqual({});
  });

  it('only resolves choice fields that have an optionsSource', async () => {
    const { strapi } = makeStrapi([{ documentId: 'd1', name: 'Red' }]);
    const schema = {
      fields: [
        { type: 'text', label: 'Name' },
        { type: 'dropdown', label: 'Static', options: [{ label: 'A', value: 'a' }] },
        {
          type: 'dropdown',
          label: 'Dynamic',
          optionsSource: { kind: 'collection', uid: 'api::color.color', labelField: 'name' },
        },
      ],
    };
    const out: any = await resolveOptionsSources(strapi, schema);

    expect(out.fields[0]).toEqual({ type: 'text', label: 'Name' }); // untouched
    expect(out.fields[1].options).toEqual([{ label: 'A', value: 'a' }]); // untouched
    expect(out.fields[2].options).toEqual([{ label: 'Red', value: 'd1' }]); // resolved
  });

  it('does not mutate the input schema object', async () => {
    const { strapi } = makeStrapi([{ documentId: 'd1', name: 'Red' }]);
    const schema = {
      fields: [
        {
          type: 'dropdown',
          optionsSource: { kind: 'collection', uid: 'api::color.color', labelField: 'name' },
        },
      ],
    };
    await resolveOptionsSources(strapi, schema);
    expect((schema.fields[0] as any).options).toBeUndefined();
  });
});
