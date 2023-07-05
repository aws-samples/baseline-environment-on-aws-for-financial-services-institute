import * as glue_alpha from '@aws-cdk/aws-glue-alpha';

/*
 * BLEA-FSI Analytics Platform Sample application Glue table schema denifition
 */

export const DepositWithdrawHistoryColumns = [
  {
    name: 'br_num',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'acct_code',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'account_num',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'trx_date',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'trx_time',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'calc_date',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'deposit',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'withdrawal',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'check_type',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'check_num',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'balance',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'trx_type',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'dst_fin_institute_num',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'dst_fin_br_num',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'dst_fin_acct_code',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'dst_fin_acct_num',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'notes',
    type: glue_alpha.Schema.STRING,
  },
];

export const CustomerColumns = [
  {
    name: 'cif_num',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'last_name',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'first_name',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'middle_name',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'phone_number',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'town_code',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'post_code',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'address',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'sex',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'birthday',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'income_range',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'marriage',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'br_num',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'acct_code',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'account_num',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'blacklisted',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'blacklist_info',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'blacklist_date',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'blacklist_time',
    type: glue_alpha.Schema.STRING,
  },
];

export const CustomerAccountColumns = [
  {
    name: 'br_num',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'acct_code',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'account_num',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'account_open_date',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'f_main_account',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'ma_br_num',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'ma_acct_code',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'ma_account_num',
    type: glue_alpha.Schema.STRING,
  },
];

export const InternetBankingUserColumns = [
  {
    name: 'cif_num',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'email_address',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'userid',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'password',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'recent_password',
    type: glue_alpha.Schema.STRING,
  },
  {
    name: 'join_date',
    type: glue_alpha.Schema.STRING,
  },
];
