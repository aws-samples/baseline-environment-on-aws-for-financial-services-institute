import * as glue_alpha from '@aws-cdk/aws-glue-alpha';

/*
 * BLEA-FSI Analytics Platform Sample application Glue master table schema denifition
 */

export const MasterTrxTypeColumns = [
  {
    name: 'trx_type_code',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'trx_type_name',
    type: glue_alpha.Schema.STRING,
  },
];

export const MasterAcctColumns = [
  {
    name: 'acct_code',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'acct_name',
    type: glue_alpha.Schema.STRING,
  },
];

export const MasterBranchColumns = [
  {
    name: 'base_date',
    type: glue_alpha.Schema.DATE,
  },
  {
    name: 'bank_code',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'bank_name_half_kana',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'bank_name_kanji',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'branch_code',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'branch_name_half_kana',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'branch_name_kanji',
    type: glue_alpha.Schema.STRING,
  },
];
