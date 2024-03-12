import { InternalServerError, NotImplementedHttpError, RepresentationMetadata } from '@solid/community-server';
import { DataFactory } from 'n3';
import { TemplateDerivationMatcher } from '../../src/TemplateDerivationMatcher';
import { DERIVED } from '../../src/Vocabularies';
import namedNode = DataFactory.namedNode;
import literal = DataFactory.literal;

describe('TemplateDerivationMatcher', (): void => {
  const identifier = { path: 'https://example.com/foo' };
  const subject = namedNode('subject');
  const selector = 'selector';
  const filter = 'filter';
  let metadata: RepresentationMetadata;
  let matcher: TemplateDerivationMatcher;

  beforeEach(async(): Promise<void> => {
    metadata = new RepresentationMetadata({ path: 'https://example.com/' });
    metadata.addQuad(subject, DERIVED.terms.template, 'foo');
    metadata.addQuad(subject, DERIVED.terms.selector, selector);
    metadata.addQuad(subject, DERIVED.terms.filter, filter);

    matcher = new TemplateDerivationMatcher();
  });

  it('can handle identifiers with matching metadata.', async(): Promise<void> => {
    await expect(matcher.canHandle({ identifier, subject, metadata })).resolves.toBeUndefined();
  });

  it('rejects invalid subjects.', async(): Promise<void> => {
    await expect(matcher.canHandle({ identifier, subject: literal('lit'), metadata }))
      .rejects.toThrow(NotImplementedHttpError);
  });

  it('rejects metadata with no templates.', async(): Promise<void> => {
    metadata.removeQuad(subject, DERIVED.terms.template, 'foo');
    await expect(matcher.canHandle({ identifier, subject, metadata }))
      .rejects.toThrow(NotImplementedHttpError);
  });

  it('rejects metadata not matching the identifier.', async(): Promise<void> => {
    metadata.removeQuad(subject, DERIVED.terms.template, 'foo');
    metadata.addQuad(subject, DERIVED.terms.template, 'not-foo');
    await expect(matcher.canHandle({ identifier, subject, metadata }))
      .rejects.toThrow(NotImplementedHttpError);
  });

  it('can match URI templates.', async(): Promise<void> => {
    metadata.removeQuad(subject, DERIVED.terms.template, 'foo');
    metadata.addQuad(subject, DERIVED.terms.template, '{var}');
    await expect(matcher.canHandle({ identifier, subject, metadata })).resolves.toBeUndefined();
  });

  it('rejects handle requests without a preceding canHandle.', async(): Promise<void> => {
    await expect(matcher.handle({ identifier, subject, metadata })).rejects.toThrow(InternalServerError);
  });

  it('parses the metadata to return a config.', async(): Promise<void> => {
    await expect(matcher.canHandle({ identifier, subject, metadata })).resolves.toBeUndefined();
    await expect(matcher.handle({ identifier, subject, metadata })).resolves.toEqual({
      mappings: {},
      selectors: [ selector ],
      filter,
    });
  });

  it('extracts variables from the template URI.', async(): Promise<void> => {
    metadata.removeQuad(subject, DERIVED.terms.template, 'foo');
    metadata.addQuad(subject, DERIVED.terms.template, '{var}');
    await expect(matcher.canHandle({ identifier, subject, metadata })).resolves.toBeUndefined();
    await expect(matcher.handle({ identifier, subject, metadata })).resolves.toEqual({
      mappings: { var: 'foo' },
      selectors: [ selector ],
      filter,
    });
  });
});
