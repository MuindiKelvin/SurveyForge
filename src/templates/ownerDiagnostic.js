import { makeQuestion } from '../utils/surveyModel';

/*
 * "Owner Business Diagnostic Survey" - the phone, laptop & electronics retail survey.
 * Numbers are assigned automatically by the app, so the duplicate/skipped numbers in the
 * original Word document (12, 12, 13, 14, 15 ... 17) no longer occur.
 */

const section = (text) => makeQuestion({ type: 'section', text });
const single = (text, options, extra = {}) => makeQuestion({ type: 'multiple_choice', text, options, ...extra });
const multi = (text, options, extra = {}) => makeQuestion({ type: 'checkboxes', text, options, maxSelections: 0, ...extra });
const paragraph = (text) => makeQuestion({ type: 'long_text', text });

const FIVE_LEVEL_CONFIDENCE = ['Very confident', 'Confident', 'Moderately confident', 'Not very confident', 'Not confident at all'];
const FREQUENCY = ['Very often', 'Often', 'Sometimes', 'Rarely', 'Never'];

export function buildOwnerDiagnosticTemplate() {
  return {
    title: 'Owner Business Diagnostic Survey - Phone, Laptop & Electronics Retail Business',
    description:
      'This survey is designed to understand the current performance, challenges, growth opportunities and technology needs of the business. The findings will guide further customer research, market analysis and the final consultancy recommendations.',
    questions: [
      // ------------------------------------------------------------------ A
      section('A. Business profile'),
      single('How long has the business operated?', ['Less than 1 year', '1\u20133 years', '4\u20136 years', '7\u201310 years', 'More than 10 years']),
      single('How would you describe the current size of the business?', ['Micro', 'Small', 'Medium', 'Large']),
      multi(
        'Which products/services does the business currently offer?',
        [
          'New smartphones', 'Refurbished smartphones', 'Laptops', 'Refurbished laptops', 'TVs', 'Phone accessories',
          'Chargers/cables', 'Phone upgrades/software services', 'Phone repairs', 'Laptop repairs', 'Other electronics',
        ],
        { help: 'Select all that apply.' },
      ),
      multi(
        'Which three categories generate the most sales?',
        ['New phones', 'Refurbished phones', 'Laptops', 'Refurbished laptops', 'TVs', 'Accessories', 'Chargers/cables', 'Repairs/upgrades', 'Other'],
        { maxSelections: 3 },
      ),

      // ------------------------------------------------------------------ B
      section('B. Business performance'),
      single('How would you describe business performance over the past 12 months?', ['Very good', 'Good', 'Average', 'Poor', 'Very poor']),
      single('Compared with the previous year, sales have:', [
        'Increased significantly', 'Increased slightly', 'Remained the same', 'Decreased slightly', 'Decreased significantly', 'Not sure',
      ]),
      single('How predictable are your monthly sales?', ['Very predictable', 'Predictable', 'Somewhat predictable', 'Unpredictable', 'Very unpredictable']),
      single('How often do you meet your sales targets?', ['Always', 'Often', 'Sometimes', 'Rarely', 'Never', 'No sales targets currently']),

      // ------------------------------------------------------------------ C
      section('C. Business challenges'),
      makeQuestion({
        type: 'matrix',
        text: 'How serious are the following challenges to your business?',
        help: 'Rate each challenge on the 5-point scale.',
        rows: [
          'Competition', 'Low customer numbers', 'Low profit margins', 'High supplier prices', 'Slow-moving stock', 'Stock-outs',
          'Cash-flow problems', 'Theft/losses', 'Employee performance', 'Customer retention', 'Marketing', 'Online competition',
          'Supply challenges', 'Other challenges faced',
        ],
        options: ['Not a problem', 'Minor', 'Moderate', 'Serious', 'Very serious'],
      }),
      multi(
        'Which THREE challenges have the greatest effect on the business?',
        [
          'Competition', 'Low customer numbers', 'Low margins', 'Supplier costs', 'Slow-moving stock', 'Stock-outs', 'Cash flow',
          'Theft/losses', 'Employees', 'Customer retention', 'Marketing', 'Online competition', 'Lack of data', 'Other',
        ],
        { maxSelections: 3 },
      ),

      // ------------------------------------------------------------------ D
      section('D. Customers & market'),
      paragraph('How often do you compare prices and terms from different suppliers before purchasing?'),
      paragraph('What criteria do you use to decide on new product prices?'),
      paragraph('How do you decide what proportion of your stock should consist of refurbished, new and second-hand products?'),
      multi('What payment options or payment plans does your business currently offer to customers?', [
        'Full payment upfront', 'Installment payments', 'Deposit followed by balance payment', 'Buy-now-pay-later arrangement',
        'Credit/Pay later', 'Mobile money payments', 'Bank/card payments', 'Other',
      ]),
      multi(
        'Which customer groups make up most of your customers?',
        ['Students', 'Young adults', 'Professionals', 'Business owners', 'SMEs', 'Families/parents', 'Government employees', 'Resellers', 'Other'],
        { help: 'Select all that apply.' },
      ),
      single('Where do most customers come from?', ['Immediate neighbourhood', 'Other parts of Nairobi', 'Other counties', 'Across Kenya', 'Outside Kenya']),
      single('What percentage of your sales are generated online?', ['0%', '1\u201310%', '11\u201325%', '26\u201350%', 'More than 50%', 'Not sure']),
      single('How important are repeat customers to your business?', ['Very important', 'Important', 'Moderately important', 'Slightly important', 'Not important']),
      single('How well do you understand what your customers want?', ['Very well', 'Well', 'Moderately', 'Poorly', 'Very poorly']),

      // ------------------------------------------------------------------ E
      section('E. Products & opportunities'),
      single('How confident are you when deciding which new products to stock?', FIVE_LEVEL_CONFIDENCE),
      single('How often do you experience slow-moving products?', FREQUENCY),
      single('How often do you run out of products that customers want?', FREQUENCY),
      multi(
        'Which areas would you consider expanding into?',
        [
          'More smartphone brands', 'More refurbished phones', 'Laptops', 'Refurbished laptops', 'TVs', 'Phone accessories',
          'Computer accessories', 'Smartwatches', 'Tablets', 'Gaming products', 'Networking equipment', 'CCTV/security equipment',
          'Repairs', 'Corporate/office technology supply', 'Other electronics',
        ],
        { help: 'Select all that apply.' },
      ),

      // ------------------------------------------------------------------ F
      section('F. Expansion'),
      single('Are you currently considering business expansion?', ['Yes, definitely', 'Yes, possibly', 'Not sure', 'No']),
      multi('Where would you consider expanding?', [
        'Another location within Nairobi', 'Other parts of Nairobi', 'Machakos', 'Kajiado', 'Kiambu', 'Mombasa', 'Nakuru', 'Kisumu',
        'Other counties', 'Online nationwide', 'I am not considering expansion',
      ]),
      single('What type of expansion would you prefer?', [
        'Physical branch', 'Online store', 'Delivery-based business', 'Wholesale/distribution', 'Corporate sales', 'Combination of these', 'Not sure',
      ]),
      single('How important is identifying the right location before expansion?', [
        'Extremely important', 'Very important', 'Important', 'Slightly important', 'Not important',
      ]),

      // ------------------------------------------------------------------ G
      section('G. Stock & suppliers'),
      single('How do you mainly decide what stock to purchase?', [
        'Previous sales', 'Customer requests', 'Personal experience', 'Supplier recommendations', 'Competitor activity', 'Available capital',
        'Combination of these', 'Mainly guesswork',
      ]),
      single('How do you currently track stock?', [
        'Notebook/manual records', 'Excel', 'POS system', 'Inventory software', 'Accounting software', 'Other digital system', 'No systematic system',
      ]),
      single('How satisfied are you with your current stock management?', ['Very satisfied', 'Satisfied', 'Neutral', 'Dissatisfied', 'Very dissatisfied']),
      single('How difficult is it to identify your most profitable products?', ['Very easy', 'Easy', 'Moderate', 'Difficult', 'Very difficult']),

      // ------------------------------------------------------------------ H
      section('H. Business systems'),
      multi(
        'Which areas currently have a formal system?',
        [
          'Sales recording', 'Stock management', 'Customer records', 'Supplier records', 'Employee performance', 'Expenses',
          'Profit tracking', 'Cash-flow tracking', 'Marketing', 'None',
        ],
        { help: 'Select all that apply.' },
      ),
      single('How often do you review business performance data?', ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annually', 'Only when problems occur', 'Never']),
      single('How confident are you in the accuracy of your business records?', FIVE_LEVEL_CONFIDENCE),
      single('How quickly can you determine your current stock position?', [
        'Immediately', 'Within a few minutes', 'Within an hour', 'Several hours', 'More than a day', 'I cannot easily determine it',
      ]),

      // ------------------------------------------------------------------ I
      section('I. Technology & AI'),
      multi(
        'Which technologies do you currently use?',
        ['WhatsApp Business', 'Excel', 'POS', 'Accounting software', 'Inventory software', 'CRM', 'Website', 'Social media', 'Mobile money/business records', 'None'],
        { help: 'Select all that apply.' },
      ),
      single("How would you rate the business's current use of technology?", ['Very advanced', 'Advanced', 'Moderate', 'Basic', 'Very basic']),
      single('Have you used AI tools in the business?', [
        'Regularly', 'Occasionally', 'Once or twice', 'I know about them but have not used them', 'I am not familiar with them',
      ]),
      multi(
        'Which areas would you like AI/technology to help with?',
        [
          'Sales analysis', 'Stock forecasting', 'Identifying slow-moving stock', 'Predicting demand', 'Customer analysis', 'Marketing',
          'Social media content', 'Customer communication', 'Competitor monitoring', 'Pricing', 'Supplier analysis', 'Financial reporting',
          'Employee performance', 'Identifying new markets', 'Identifying new products', 'Business forecasting',
        ],
        { help: 'Select all that apply.' },
      ),
      single('How valuable would automated daily business reports be to you?', [
        'Extremely valuable', 'Very valuable', 'Moderately valuable', 'Slightly valuable', 'Not valuable',
      ]),
      multi(
        'Which information would you most like to receive automatically?',
        [
          'Daily sales', 'Daily profit', 'Best-selling products', 'Slow-moving products', 'Stock levels', 'Products likely to run out',
          'Customer trends', 'Market trends', 'Competitor prices', 'Recommended products to stock', 'Recommended pricing', 'Cash-flow position',
        ],
        { maxSelections: 3 },
      ),

      // ------------------------------------------------------------------ J
      section('J. Future priorities'),
      multi(
        'Which THREE areas should the consultancy focus on?',
        [
          'Finding the best expansion markets', 'Identifying new products', 'Increasing sales', 'Increasing profit', 'Improving stock management',
          'Improving customer retention', 'Improving marketing', 'Improving employee performance', 'Improving business systems',
          'Reducing costs', 'Introducing AI', 'Increasing online sales', 'Understanding competitors',
        ],
        { maxSelections: 3 },
      ),
      makeQuestion({
        type: 'matrix',
        text: 'How important is each of the following to your business over the next 1\u20133 years?',
        help: '1 = Not important, 5 = Extremely important.',
        rows: ['Increase sales', 'Increase profit margins', 'Open another branch', 'Expand outside Nairobi', 'Increase online sales', 'Introduce new products'],
        options: ['1 \u2013 Not important', '2 \u2013 Slightly important', '3 \u2013 Moderately important', '4 \u2013 Very important', '5 \u2013 Extremely important'],
      }),
    ],
  };
}

export const TEMPLATES = {
  'owner-diagnostic': {
    id: 'owner-diagnostic',
    name: 'Owner Business Diagnostic',
    description: 'Phone, laptop & electronics retail - 43 questions in 10 sections, built from your Word document.',
    build: buildOwnerDiagnosticTemplate,
  },
};
