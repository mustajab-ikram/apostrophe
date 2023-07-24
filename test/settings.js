const t = require('../test-lib/test.js');
const assert = require('assert/strict');

describe('user settings', function () {
  this.timeout(t.timeout);

  let apos;

  beforeEach(async function() {
    await t.destroy(apos);
    apos = null;
  });

  after(async function() {
    return t.destroy(apos);
  });

  it('should have settings module', async function() {
    apos = await t.create({
      root: module
    });
    assert(apos.modules['@apostrophecms/settings'], 'module not found');
    assert(apos.settings, 'module alias not found');
    assert.deepEqual(apos.settings.options.subforms, {});
    assert.deepEqual(apos.settings.options.groups, {});
    assert.deepEqual(apos.settings.subforms, []);
    assert.deepEqual(apos.settings.userSchema, []);
    assert.equal(apos.settings.hasSchema(), false);
  });

  it('should panic on non-existing or forbidden user field in subforms', async function () {
    apos = await t.create({
      root: module
    });

    apos.settings.options.subforms = {
      test: {
        fields: [ 'nonExistingField' ]
      }
    };
    assert.throws(
      apos.settings.initSubforms,
      {
        message: '[@apostrophecms/settings] The field "nonExistingField" is not a valid user field.'
      }
    );

    const testFields = [
      'role',
      'username',
      'password',
      'email'
    ];

    for (const field of testFields) {
      apos.settings.options.subforms = {
        test: {
          fields: [ field ]
        }
      };
      assert.throws(
        apos.settings.initSubforms,
        {
          message: `[@apostrophecms/settings] The field "${field}" is forbidden.`
        }
      );
    }
  });

  // It should process settings schema and register the subset of the user schema that
  // is relevant to the configured subforms.
  it('should init subforms', async function () {
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/i18n': {
          options: {
            adminLocales: [
              {
                label: 'English',
                value: 'en'
              },
              {
                label: 'French',
                value: 'fr'
              }
            ]
          }
        },
        '@apostrophecms/user': {
          fields: {
            add: {
              firstName: {
                type: 'string',
                label: 'First Name'
              },
              lastName: {
                type: 'string',
                label: 'Last Name'
              }
            }
          }
        },
        '@apostrophecms/settings': {
          options: {
            subforms: {
              name: {
                label: 'Name',
                fields: [ 'firstName', 'lastName' ],
                preview: '{{ firstName }} {{ lastName }}'
              },
              adminLocale: {
                fields: [ 'adminLocale' ]
              }
            }
          }
        }
      }
    });

    // Schema is processed
    const schema = apos.settings.userSchema;
    assert.equal(apos.settings.hasSchema(), true);
    assert.equal(schema.length, 3);
    assert(schema.some(field => field.name === 'firstName'));
    assert(schema.some(field => field.name === 'lastName'));
    assert(schema.some(field => field.name === 'adminLocale'));

    const nameSchema = apos.settings.getSubformSchema('name');
    assert.equal(nameSchema.length, 2);
    assert(nameSchema.some(field => field.name === 'firstName'));
    assert(nameSchema.some(field => field.name === 'lastName'));

    const adminLocaleSchema = apos.settings.getSubformSchema('adminLocale');
    assert.equal(adminLocaleSchema.length, 1);
    assert(adminLocaleSchema.some(field => field.name === 'adminLocale'));

    // Subforms are initialized
    const subforms = apos.settings.subforms;
    assert.equal(subforms.length, 2);

    const nameSubform = subforms.find(subform => subform.name === 'name');
    assert.equal(nameSubform.label, 'Name');
    assert.equal(nameSubform.preview, '{{ firstName }} {{ lastName }}');
    assert.deepEqual(nameSubform.schema, nameSchema);

    const adminLocaleSubform = subforms.find(subform => subform.name === 'adminLocale');
    assert.equal(adminLocaleSubform.label, adminLocaleSchema[0].label);
    assert.equal(adminLocaleSubform.preview, undefined);
    assert.deepEqual(adminLocaleSubform.schema, adminLocaleSchema);

    // Appropriate browser data is sent
    const browserData = apos.settings.getBrowserData();
    assert.deepEqual(browserData.subforms, subforms);
    assert.equal(browserData.action, '/api/v1/@apostrophecms/settings');
  });
});
