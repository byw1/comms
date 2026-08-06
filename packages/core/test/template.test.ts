import { describe, it, expect } from 'vitest';
import { renderTemplate, firstNameOf, hasTemplateVariables } from '../src/template.js';

describe('renderTemplate', () => {
  const ctx = {
    contact: { name: 'Jordan Blake', first_name: 'Jordan', company: 'Acme' },
    agent: { name: 'Sam Rivera', first_name: 'Sam' },
    ticket: { number: 1042 },
  };

  it('substitutes known variables', () => {
    expect(renderTemplate('Hi {{contact.first_name}}, — {{agent.first_name}}', ctx)).toBe(
      'Hi Jordan, — Sam',
    );
  });

  it('coerces non-string values', () => {
    expect(renderTemplate('Ticket #{{ticket.number}}', ctx)).toBe('Ticket #1042');
  });

  it('tolerates whitespace inside the braces', () => {
    expect(renderTemplate('Hi {{  contact.first_name  }}', ctx)).toBe('Hi Jordan');
  });

  it('falls back to "there" for missing values rather than leaving a hole', () => {
    expect(renderTemplate('Hi {{contact.first_name}}', {})).toBe('Hi there');
  });

  it('uses an explicit pipe fallback when provided', () => {
    expect(renderTemplate('Hi {{contact.first_name|friend}}', {})).toBe('Hi friend');
  });

  it('treats empty strings as missing', () => {
    expect(renderTemplate('Hi {{contact.first_name}}', { contact: { first_name: '' } })).toBe(
      'Hi there',
    );
  });

  it('leaves unknown paths safe and does not evaluate anything', () => {
    expect(renderTemplate('{{constructor.name}}', ctx)).toBe('there');
  });

  it('renders repeated variables', () => {
    expect(renderTemplate('{{contact.first_name}} {{contact.first_name}}', ctx)).toBe(
      'Jordan Jordan',
    );
  });
});

describe('firstNameOf', () => {
  it('takes the first token of a full name', () => {
    expect(firstNameOf('Jordan Blake')).toBe('Jordan');
  });

  it('returns null for phone-number-ish handles', () => {
    expect(firstNameOf('+15551234567')).toBeNull();
    expect(firstNameOf('(555) 123-4567')).toBeNull();
  });

  it('returns null for emails', () => {
    expect(firstNameOf('jordan@acme.com')).toBeNull();
  });

  it('returns null for blank input', () => {
    expect(firstNameOf('   ')).toBeNull();
    expect(firstNameOf(null)).toBeNull();
  });
});

describe('hasTemplateVariables', () => {
  it('detects variables', () => {
    expect(hasTemplateVariables('Hi {{contact.first_name}}')).toBe(true);
    expect(hasTemplateVariables('Hi there')).toBe(false);
  });
});
