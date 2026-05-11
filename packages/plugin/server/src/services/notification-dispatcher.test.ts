import { describe, it, expect } from 'vitest';
import { renderTemplate } from './notification-dispatcher';

describe('renderTemplate', () => {
  const labelByFieldId = new Map([
    ['name', 'Name'],
    ['email', 'Email'],
  ]);

  it('substitutes a field value by id', () => {
    const out = renderTemplate('Hello {{name}}', {
      data: { name: 'Alice', email: 'a@b.co' },
      labelByFieldId,
    });
    expect(out).toBe('Hello Alice');
  });

  it('substitutes a field label via fieldLabel:', () => {
    const out = renderTemplate('Field is {{fieldLabel:email}}', {
      data: { email: 'a@b.co' },
      labelByFieldId,
    });
    expect(out).toBe('Field is Email');
  });

  it('renders {{all}} as label: value newline-separated', () => {
    const out = renderTemplate('{{all}}', {
      data: { name: 'Alice', email: 'a@b.co' },
      labelByFieldId,
    });
    expect(out).toBe('Name: Alice\nEmail: a@b.co');
  });

  it('handles arrays and objects', () => {
    const out = renderTemplate('{{tags}} {{meta}}', {
      data: { tags: ['x', 'y'], meta: { k: 1 } },
      labelByFieldId: new Map(),
    });
    expect(out).toBe('x, y {"k":1}');
  });

  it('leaves unknown placeholders empty', () => {
    const out = renderTemplate('Pre {{nope}} post', {
      data: {},
      labelByFieldId: new Map(),
    });
    expect(out).toBe('Pre  post');
  });
});
