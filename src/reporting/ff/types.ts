export interface IFFReport {
  date_start: string; // Start date of the reporting period
  date_end: string; // End date of the reporting period
  companyDetails: CompanyDetails; // Details about the company
  plainAccountInfoData: PlainAccountInfoData; // Basic account information
  accountInfo: AccountInfo[]; // Detailed account information
  userLanguage: string; // Language preference of the user
  userReception: number; // User reception metric
  trades: Trades; // Trade details
  account_at_start: AccountBalance; // Account balance at the start of the period
  account_at_end: AccountBalance; // Account balance at the end of the period
  off_balance_money: OffBalanceMoney; // Money not included in the balance
  off_balance_securities: OffBalanceSecurities; // Securities not included in the balance
  off_balance_securities_prices: OffBalanceSecuritiesPrices; // Prices of off-balance securities
  off_balance_securities_accounts: OffBalanceSecuritiesAccounts; // Accounts for off-balance securities
  cash_flows: CashFlows; // Cash flow details
  cash_in_outs: CashInOut[]; // Cash in and out transactions
  in_outs_securities: SecuritiesInOuts; // Securities in and out details
  securities_in_outs: SecuritiesInOut[]; // Detailed securities in and out transactions
  securities_in_outs_not_done_but_paid_before_period: any[]; // Securities transactions not completed but paid before the period
  commissions: Commissions; // Commission details
  corporate_actions: CorporateActions; // Corporate actions details
  ffbo_trades_offsetting: any[]; // Offsetting trades
  cash_flows_json: CashFlowsJson[]; // JSON representation of cash flows
  cash_flows_off_balance_json: CashFlowsOffBalanceJson[]; // JSON representation of off-balance cash flows
  securities_flows_json: SecuritiesFlowsJson[]; // JSON representation of securities flows
  securities_flows_off_balance_json: any[]; // JSON representation of off-balance securities flows
}

interface SecuritiesFlowsJson {
  date_start: string; // Start date of the securities flow
  date_end: string; // End date of the securities flow
  ticker: string; // Ticker symbol of the security
  isin: string; // ISIN of the security
  quantity_at_start: number; // Quantity at the start of the period
  securities_traded: number; // Number of securities traded
  securities_flowed: number; // Number of securities flowed
  quantity_at_end: number; // Quantity at the end of the period
  security_price_at_start: number; // Price of the security at the start
  security_price: number; // Current price of the security
  security_currency: string; // Currency of the security
  position_value: number; // Value of the position
  mkt_id: null | string; // Market ID
  instr_type: number; // Instrument type
  instr_kind: number; // Instrument kind
}

interface CashFlowsOffBalanceJson {
  date_start: string; // Start date of the off-balance cash flow
  date_end: string; // End date of the off-balance cash flow
  curr: string; // Currency of the cash flow
  curr_at_start: number; // Currency amount at the start
  curr_flowed: number; // Currency amount flowed
  curr_at_end: number; // Currency amount at the end
}

interface CashFlowsJson {
  date_start: string; // Start date of the cash flow
  date_end: string; // End date of the cash flow
  curr: string; // Currency of the cash flow
  curr_at_start: number; // Currency amount at the start
  curr_traded: number; // Currency amount traded
  curr_commissioned: string; // Currency amount commissioned
  curr_flowed: string; // Currency amount flowed
  curr_at_end: number; // Currency amount at the end
}

interface CorporateActions {
  detailed: CorporateActionDetail[]; // Detailed corporate actions
  total: CorporateActionTotal; // Total corporate actions
}

interface CorporateActionDetail {
  date: string; // Date of the corporate action
  type: string; // Type of corporate action
  type_id: string; // ID of the corporate action type
  corporate_action_id: string; // Corporate action ID
  amount: number; // Amount involved in the action
  amount_per_one: number; // Amount per unit
  asset_type: string; // Type of asset
  ticker: string; // Ticker symbol
  isin: string; // ISIN
  currency: string; // Currency
  ex_date: string; // Ex-dividend date
  external_tax: number | string; // External tax amount
  external_tax_currency: string; // Currency of the external tax
  tax_amount: number | string; // Tax amount
  tax_currency: string; // Currency of the tax
  comment: string; // Additional comments
  q_on_ex_date: string; // Quantity on ex-date
}

interface Commissions {
  detailed: CommissionDetail[]; // Detailed commission information
  total: CommissionTotal; // Total commission
}

interface CommissionDetail {
  sum: string; // Sum of the commission
  currency: string; // Currency of the commission
  type: string; // Type of commission
  comment: string; // Additional comments
  datetime: string; // Date and time of the commission
}

interface SecuritiesInOut {
  id: number; // ID of the transaction
  auth_login: string; // Authorized login
  quantity: string; // Quantity involved
  ticker: string; // Ticker symbol
  type: string; // Type of transaction
  datetime: string; // Date and time of the transaction
  date_created: string; // Date the transaction was created
  operator: string; // Operator of the transaction
  transaction_id: null | number; // Transaction ID
  approved: number; // Approval status
  superviser: string; // Supervisor of the transaction
  comment: string; // Additional comments
  commission: string; // Commission amount
  commission_currency: null | string; // Currency of the commission
  balance: string; // Balance after the transaction
  offbalance: null | number; // Off-balance amount
  balance_currency: string; // Currency of the balance
  fifo_profit: string; // FIFO profit
  quantity_before: string; // Quantity before the transaction
  cps_id: null | number; // CPS ID
  phantom: null | number; // Phantom status
  otc_trade_id: null; // OTC trade ID
  cost: string; // Cost of the transaction
  details: null; // Additional details
  reverted: number; // Reversion status
  reverted_by: null; // Reverted by
  reverted_datetime: null; // Date and time of reversion
  market_value: null | string; // Market value
  market_value_usd: null | string; // Market value in USD
  market_value_details: null | string; // Details of the market value
  pay_d: string; // Payment date
}

interface SecuritiesInOuts {
  detailed: SecuritiesInOutDetail[]; // Detailed securities in and out information
  total: SecuritiesInOutTotal; // Total securities in and out
}

type SecuritiesInOutTotal = Record<string, number>;

interface SecuritiesInOutDetail {
  date: string; // Date of the transaction
  account: string; // Account involved
  quantity: number; // Quantity involved
  ticker: string; // Ticker symbol
  isin: string; // ISIN
  type: string; // Type of transaction
  comment: string; // Additional comments
}

interface CashInOut {
  id: number; // ID of the transaction
  auth_login: string; // Authorized login
  currency: string; // Currency of the transaction
  type: string; // Type of transaction
  datetime: string; // Date and time of the transaction
  date_created: string; // Date the transaction was created
  operator: string; // Operator of the transaction
  approved: number; // Approval status
  superviser: string; // Supervisor of the transaction
  comment: string; // Additional comments
  commission_currency: null; // Currency of the commission
  offbalance: null | number; // Off-balance amount
  cps_id: null | number; // CPS ID
  phantom: number; // Phantom status
  ticker: null | string; // Ticker symbol
  otc_trade_id: null; // OTC trade ID
  details: null | string; // Additional details
  bank: null; // Bank involved
  notification_details: null | string; // Notification details
  reverted: number; // Reversion status
  reverted_by: null; // Reverted by
  reverted_datetime: null | string; // Date and time of reversion
  pay_d: string; // Payment date
  value_usd_details: string; // Details of the value in USD
  transaction_id: null | number; // Transaction ID
  amount: string; // Amount involved
  commission: string; // Commission amount
  value_usd: string; // Value in USD
  iban: null; // IBAN
  corporate_action_id: null | string; // Corporate action ID
}

interface CashFlows {
  detailed: CashFlowDetail[]; // Detailed cash flow information
  total: CashFlowTotal; // Total cash flow
}

interface CashFlowTotal {
  EUR: string; // Total in EUR
  USD: string; // Total in USD
}

interface CashFlowDetail {
  date: string; // Date of the cash flow
  account: string; // Account involved
  account_id: number; // Account ID
  sum: string; // Sum of the cash flow
  amount: number; // Amount involved
  currency: string; // Currency of the cash flow
  type: string; // Type of cash flow
  type_id: string; // ID of the cash flow type
  comment: string; // Additional comments
}

interface OffBalanceMoney {
  // Placeholder for off-balance money details
}

interface AccountBalance {
  date: string; // Date of the account balance
  account: AccountDetails; // Account details
}

interface AccountDetails {
  net_assets: number; // Net assets of the account
  positions_from_ts: PositionsFromTS; // Positions from timestamp
  repo_positions: any[]; // Repo positions
}

interface PositionsFromTS {
  ps: PositionSummary; // Position summary
}

interface PositionSummary {
  acc: AccountPosition[]; // Account positions
  pos: Position[]; // Positions
}

interface Position {
  i: string; // Instrument identifier
  t: number; // Type of instrument
  k: number; // Kind of instrument
  s: number; // Status of the position
  q: number; // Quantity of the position
  fv: number; // Face value
  curr: string; // Currency
  currval: number; // Current value
  name: string; // Name of the instrument
  name2: string; // Secondary name of the instrument
  open_bal: number; // Opening balance
  mkt_price: string; // Market price
  vm: number; // Valuation margin
  go: number; // Go value
  profit_close: number; // Profit on close
  acc_pos_id: number; // Account position ID
  accruedint_a: number; // Accrued interest
  acd: number; // Accrued dividend
  bal_price_a: number; // Balance price
  price_a: number; // Price
  base_currency: string; // Base currency
  face_val_a: number; // Face value amount
  scheme_calc: string; // Calculation scheme
  instr_id: number; // Instrument ID
  Yield: number; // Yield
  issue_nb: string; // Issue number
  profit_price: number; // Profit price
  market_value: number; // Market value
  close_price: number; // Close price
  code_nm: string; // Code name
  base_contract_code: string; // Base contract code
  mkt_id: string; // Market ID
  ltr: string; // Letter
  mkt_price_updated_from_quotes: boolean; // Market price updated from quotes
  p: string; // Price
  cur_exchange_rate: number; // Current exchange rate
  posval: number; // Position value
  mval: number; // Market value
  profit: number; // Profit
  profit_in_position_currency: number; // Profit in position currency
  gain: number; // Gain
  total_securities: number; // Total securities
  net_assets: number; // Net assets
  unrealized_profit: number; // Unrealized profit
  total_stocks: number; // Total stocks
  total_bonds: number; // Total bonds
  total_forts: number; // Total forts
  total_crypto: number; // Total cryptocurrencies
  margin_securities: number; // Margin securities
}

interface AccountPosition {
  s: number; // Status
  forecast_in_a: number; // Forecast in amount
  forecast_out_a: number; // Forecast out amount
  curr: string; // Currency
  currval: number; // Current value
  t2_in: number; // T2 in
  t2_out: number; // T2 out
  k: number; // Kind
  t: number; // Type
  base_currency: string; // Base currency
  cur_exchange_rate: number; // Current exchange rate
  posval: number; // Position value
  net_assets: number; // Net assets
  margin_money: number; // Margin money
}

interface Trades {
  detailed: TradeDetail[]; // Detailed trade information
  securities: TradeSecurities; // Securities involved in trades
  total: TradeTotal; // Total trade value
  prtotal: TradeTotal; // Total trade value in preferred currency
}

interface TradeTotal {
  USD: number; // Total in USD
  EUR: number; // Total in EUR
}

type TradeSecurities = Record<string, number>;

interface TradeDetail {
  trade_id: number; // Trade ID
  date: string; // Date of the trade
  short_date: string; // Short date format
  pay_d: string; // Payment date
  instr_nm: string; // Instrument name
  instr_type: number; // Instrument type
  instr_kind: string; // Instrument kind
  issue_nb: null | string; // Issue number
  operation: string; // Operation type
  p: number; // Price
  curr_c: string; // Currency code
  q: number; // Quantity
  summ: number; // Sum of the trade
  turnover: string; // Turnover
  profit: number; // Profit
  fifo_profit: string; // FIFO profit
  repo_operation: null; // Repo operation
  mkt_id: number; // Market ID
  order_id: string; // Order ID
  office: number; // Office number
  yield: null; // Yield
  commission: number; // Commission amount
  commission_currency: string; // Currency of the commission
  comment: string; // Additional comments
  transaction_id: number; // Transaction ID
  isin: string; // ISIN
  offbalance: number; // Off-balance amount
  otc: number; // OTC status
  is_dvp: number; // DVP status
  stamp_tax: null; // Stamp tax
  smat: number; // SMAT status
  forts_exchange_fee: null; // Forts exchange fee
  trade_nb: string; // Trade number
  broker: null | string; // Broker
  das_exe_id: null | string; // DAS execution ID
  market: null | string; // Market
  mkt_name: string; // Market name
  id: string; // ID
}

interface AccountInfo {
  ' Account type ': string; // Type of account
  ' Client ': string; // Client name
  ' Client ID ': string; // Client ID
  ' Commission currency ': string; // Currency for commission
  ' Service plan: ': string; // Service plan
  'Date of signing the contract': string; // Date contract was signed
  'Date of first deposit': string; // Date of first deposit
}

interface PlainAccountInfoData {
  account_type: string; // Type of account
  client_name: string; // Name of the client
  client_code: string; // Client code
  base_currency: string; // Base currency
  tariff_name: string; // Name of the tariff
  client_date_open: string; // Date the client account was opened
  activation_date: string; // Date the account was activated
}

interface CompanyDetails {
  address: string; // Address of the company
  companyName: string; // Name of the company
  brokerLicenceName: string; // Name of the broker license
  brokerLicenceNumber: string; // Number of the broker license
  brokerPhone: string; // Phone number of the broker
  brokerEmail: string; // Email of the broker
  website: string; // Website of the company
  image: string; // Image URL of the company
}

interface OffBalanceSecurities {
  // Placeholder for off-balance securities details
}

interface OffBalanceSecuritiesPrices {
  // Placeholder for off-balance securities prices details
}

interface OffBalanceSecuritiesAccounts {
  // Placeholder for off-balance securities accounts details
}

interface CorporateActionTotal {
  // Placeholder for total corporate actions details
}

interface CommissionTotal {
  // Placeholder for total commission details
}
