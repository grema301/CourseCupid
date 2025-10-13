# Course Cupid 

**An AI-powered course recommendation system disguised as a dating app for University of Otago first-year students**

Course Cupid transforms the traditionally overwhelming process of course selection into an engaging, gamified experience. Students can discover their perfect academic matches through personality quizzes, chat with AI-powered "course personalities," and make informed decisions about their first-year papers through a familiar dating app interface.

## Project Overview

### Core Concept
Course Cupid presents University of Otago first-year papers as individual "personalities" that students can interact with through a dating app paradigm. Each course has its own AI chatbot that embodies the paper's characteristics, making course discovery both informative and entertaining.

### Key Features
- **Personality Quiz**: AI-powered course matching based on student interests and goals
- **Course Chat**: Interactive conversations with AI-powered course personalities
- **Swipe Interface**: Tinder-like UI for course discovery and matching
- **Course Database**: Comprehensive first-year paper information with real course data
- **User Accounts**: Session management, match history, and personalized recommendations
- **General AI Chat**: Cupid chatbot for general academic guidance

## System Architecture

### Frontend Architecture
- **Framework**: Vanilla JavaScript with Tailwind CSS
- **Structure**: Multi-page application with shared components
- **Key Pages**:
  - Landing page with course browsing
  - Interactive personality quiz
  - Chat interface for course and Cupid conversations
  - User authentication and account management

### Backend Architecture
- **Server**: Node.js with Express.js
- **Database**: PostgreSQL with custom schema
- **AI Integration**: 
  - Google Gemini API for course matching embeddings
  - Groq API (Llama) for course personality chat
- **Session Management**: Express sessions with PostgreSQL storage

### Data Flow
1. **Course Data Ingestion**: Web scrapers collect University of Otago course information
2. **AI Processing**: Course descriptions vectorized using Google Gemini embeddings
3. **User Interaction**: Quiz responses processed through similarity matching
4. **Chat Generation**: Course personalities generated via Groq API with contextual prompts
5. **Match Persistence**: User selections stored in PostgreSQL for future reference

## Quick Start Guide

### Prerequisites
- **Node.js** (v16 or higher)
- **Python** (3.8 or higher)
- **PostgreSQL** database
- API keys for Google Gemini and Groq

### Installation

1. **Clone the repository**
   ```bash
   git clone https://isgb.otago.ac.nz/cosc345/git/grema301/Group_13.git
   cd Group_13-1
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

3. **Set up Python environment**
   ```bash
   python -m venv venv
   
   # Windows
   venv\Scripts\activate
   
   # macOS/Linux
   source venv/bin/activate
   
   pip install -r requirements.txt
   ```

4. **Environment Configuration**
   Create a `.env` file in the root directory:
   ```env
   # Database Configuration
   DATABASE_URL=postgresql://username:password@localhost:5432/database_name
   
   # AI API Keys
   GEMINI_API_KEY=your_google_gemini_api_key
   GROQ_API_KEY=your_groq_api_key
   
   ```

5. **Database Setup**
   ```bash
   # Create database schema
   psql -d your_database -f db/sql-tables.sql
   
   # Import course data (optional)
   node db/importPapers.js
   ```

6. **Start the application**
   ```bash
   npm start
   ```

7. **Access the application**
   - Navigate to `http://localhost:3000`
   - Create an account or use as a guest
   - Take the personality quiz to get course recommendations

## Project Structure

```
Course-Cupid/
├── frontend/                 # Client-side application
│   ├── index.html           # Landing page
│   ├── quiz.html            # Personality quiz interface
│   ├── chat.html            # Chat interface for courses/Cupid
│   ├── login.html           # Authentication pages
│   ├── signup.html
│   ├── style.css            # Main stylesheet
│   ├── app.js               # Core frontend logic
│   ├── js/
│   │   ├── chat.js          # Chat functionality
│   │   ├── quiz.js          # Quiz logic and course cards
│   │   └── messages.js      # Message handling
│   └── css/
│       └── chat.css         # Chat-specific styles
│
├── db/                      # Database layer
│   ├── api-server.js        # Express API routes
│   ├── sql-tables.sql       # Database schema
│   ├── schema.sql           # Legacy schema
│   ├── importPapers.js      # Course data import script
│   └── test-insert-data/    # Sample data for testing
│
├── webscrappers/            # Data collection tools
│   ├── paperscrapper.py     # University of Otago course scraper
│   ├── papercode.py         # Course code extraction
│   ├── papers_data.json     # Scraped course information
│   └── paper_codes_100.txt  # First-year course codes
│
├── server.js                # Main Express server
├── google_course_matcher.py # AI course recommendation engine
├── course_matcher.py        # Alternative matching system
├── package.json             # Node.js dependencies
├── requirements.txt         # Python dependencies
└── README.md               # This file
```

## Database Schema

### Core Tables
- **Web_User**: User accounts and authentication
- **Chat_Session**: Chat sessions (both course and Cupid)
- **Chat_Message**: Individual messages within sessions
- **Paper**: Course information and metadata
- **user_paper_matches**: User course preferences/matches

### Relationships
- Users can have multiple chat sessions
- Sessions contain multiple messages
- Papers can be referenced in multiple sessions
- User matches link users to preferred courses

## AI Integration

### Course Matching (Google Gemini)
- **Purpose**: Generate semantic embeddings for course descriptions
- **Process**: 
  1. Course descriptions vectorized using `gemini-embedding-001`
  2. User quiz responses converted to query embeddings
  3. Cosine similarity matching for top 5 recommendations
- **File**: `google_course_matcher.py`

### Course Personalities (Groq/Llama)
- **Purpose**: Create engaging course chatbots
- **Process**:
  1. Dynamic prompt generation incorporating course details
  2. Role-play as course "seeking" students (dating app metaphor)
  3. Contextual responses about course content and requirements
- **Model**: `meta-llama/llama-4-scout-17b-16e-instruct`

## API Endpoints

### Authentication
- `POST /api/signup` - User registration
- `POST /api/login` - User authentication
- `POST /api/logout` - Session termination
- `GET /api/me` - Current user information

### Course Data
- `GET /api/papers` - Paginated course listings with search/filter
- `POST /api/quiz-recommendations` - AI-powered course matching
- `POST /api/match` - Save user course preferences
- `GET /api/my-matches` - Retrieve user's matched courses

### Chat System
- `POST /api/chat/:identifier` - Send message (course or Cupid)
- `GET /api/chat/:identifier/messages` - Retrieve chat history
- `POST /api/chat-sessions` - Create new Cupid chat session
- `GET /api/chat-sessions` - List user's chat sessions
- `DELETE /api/chat-sessions/:identifier` - Remove chat session

## Data Sources

### University of Otago Course Information
- **Source**: Official University of Otago course catalog
- **Scraping**: Automated collection via `paperscrapper.py`
- **Coverage**: All first-year papers (100-level courses)
- **Data Points**: Course codes, titles, descriptions, subjects, prerequisites

### Content Processing
- **Format**: JSON structure with course metadata
- **Validation**: Missing/incomplete course data filtered during import
- **Updates**: Manual re-scraping required for course changes

## Security Features

### Authentication & Authorization
- **Password Hashing**: bcrypt with salt rounds
- **Session Management**: Express sessions with PostgreSQL storage
- **CSRF Protection**: Session-based validation
- **Input Validation**: Parameterized queries prevent SQL injection

### Data Privacy
- **User Data**: Minimal collection (username, email, preferences)
- **Chat History**: Stored locally, associated with user sessions
- **API Keys**: Environment variable configuration
- **Course Data**: Public university information only

## User Experience

### Design Philosophy
- **Familiar Interface**: Dating app mechanics for intuitive navigation
- **Gamification**: Swipe-based course discovery
- **Personalization**: AI-driven recommendations based on user input
- **Accessibility**: Clean, responsive design with clear navigation

### User Journey
1. **Landing**: Browse featured courses, create account
2. **Quiz**: Answer personality/preference questions
3. **Recommendations**: Swipe through AI-matched courses
4. **Chat**: Interact with course personalities
5. **Matches**: Review and manage selected courses

## Testing & Development

### Local Development
```bash
# Start development server
npm start

# Test database connection
node -e "require('./db/api-server').pool.query('SELECT NOW()').then(r => console.log(r.rows[0]))"
```

### Course Data Updates
```bash
# Re-scrape University of Otago courses
cd webscrappers
python paperscrapper.py

# Import updated course data
cd ..
node db/importPapers.js
```

## Deployment Considerations

### Environment Setup
- **Production Database**: PostgreSQL with connection pooling
- **Environment Variables**: All sensitive data externalized
- **API Rate Limits**: Consider caching for AI API calls
- **Static Assets**: CDN for frontend resources

### Scalability
- **Database Indexing**: Optimize queries for user sessions and course searches
- **Caching**: Redis for session storage and frequent API responses
- **Load Balancing**: Multiple server instances for high traffic
- **Monitoring**: Application performance and API usage tracking

## Contributing

### Development Workflow
1. Create feature branch from main
2. Implement changes with appropriate testing
3. Update documentation for new features
4. Submit pull request with detailed description

### Code Standards
- **JavaScript**: ESLint configuration provided
- **Python**: PEP 8 style guidelines
- **SQL**: Consistent naming conventions
- **Comments**: Document complex business logic

## Troubleshooting

### Common Issues

**"Database connection failed"**
- Verify PostgreSQL is running and accessible
- Check DATABASE_URL environment variable
- Ensure database exists and schema is created
- If using University of Otago provided PostgreSQL, ensure IP is within UoO Network.

**"AI API errors"**
- Confirm GEMINI_API_KEY and GROQ_API_KEY are set
- Check API key validity and quota limits
- Verify network connectivity to AI services
- Ensure API hosts are active

**"Course data missing"**
- Run `node db/importPapers.js` to populate database
- Check `webscrappers/papers_data.json` exists and is valid
- Verify database permissions for data insertion

**"Python script failures"**
- Ensure virtual environment is activated
- Verify all Python dependencies installed
- Check python executable path in `spawn` calls

## Possible Future Enhancements

### Planned Features
- **Advanced Filtering**: Prerequisite tracking, timetable integration
- **Social Features**: Student reviews, peer recommendations
- **Academic Planning**: Multi-year course planning assistance
- **Mobile App**: Native iOS/Android applications
- **Institution Expansion**: Support for other universities

### Technical Improvements
- **AI Enhancement**: Fine-tuned models for better course personalities
- **Performance**: Database optimization and caching strategies
- **Testing**: Comprehensive unit and integration test suites

## License

This project is developed for educational purposes as part of COSC345 Software Engineering at the University of Otago.

## Team Members

- **Katrina Hogg** - Database Design & Backend Architecture
- **Benjamin Hunt** - Account Creation/Features and Backend Architecture
- **Shyamalima Das** - Frontend Development & User Experience
- **Ned Redmond** - Sentence Transformer AI integration and Quiz Features
- **Matthew Greer** - Web Scrapping/Data Processing and LLM Chatbot

---

*Course Cupid - Making course selection as easy as finding your perfect match! 💘*
