describe('Perspective Replay Feature', () => {
  const testUrl = 'https://example.com/test-article';
  const testContentId = 'test-content-id-replay';

  beforeEach(() => {
    // Mock authentication
    cy.window().then((win) => {
      win.localStorage.setItem('supabase.auth.token', JSON.stringify({
        currentSession: {
          user: { id: 'test-user-1', email: 'test1@example.com' }
        }
      }));
    });
  });

  it('should show replay toggle when past sessions exist', () => {
    // Mock the sessions endpoint to return past discussions
    cy.intercept('GET', `http://localhost:3001/content/${testContentId}/sessions`, {
      statusCode: 200,
      body: {
        sessions: [
          {
            id: 'session-1',
            highlightedText: 'interesting passage from the article',
            transcript: [
              {
                userId: 'user-1',
                message: 'This is a great point!',
                timestamp: '2025-10-05T10:00:00Z'
              },
              {
                userId: 'user-2',
                message: 'I totally agree',
                timestamp: '2025-10-05T10:01:00Z'
              }
            ],
            participantCount: 2,
            createdAt: '2025-10-05T10:00:00Z'
          }
        ]
      }
    }).as('getSessions');

    // Mock the content endpoint
    cy.intercept('GET', '**/content*', {
      statusCode: 200,
      body: {
        data: {
          id: testContentId,
          processed_text: JSON.stringify({
            metadata: { title: 'Test Article' },
            paragraphs: [
              'This is the first paragraph.',
              'This is an interesting passage from the article.',
              'This is the last paragraph.'
            ]
          })
        }
      }
    });

    cy.visit(`/reading/${testContentId}`);

    // Wait for sessions to load
    cy.wait('@getSessions');

    // Check that the Perspective Replay toggle appears
    cy.contains('Perspective Replay').should('be.visible');
  });

  it('should not show replay toggle when no past sessions exist', () => {
    // Mock empty sessions
    cy.intercept('GET', `http://localhost:3001/content/${testContentId}/sessions`, {
      statusCode: 200,
      body: { sessions: [] }
    });

    cy.intercept('GET', '**/content*', {
      statusCode: 200,
      body: {
        data: {
          id: testContentId,
          processed_text: JSON.stringify({
            metadata: { title: 'Test Article' },
            paragraphs: ['First paragraph.', 'Second paragraph.']
          })
        }
      }
    });

    cy.visit(`/reading/${testContentId}`);

    // Replay toggle should not appear
    cy.contains('Perspective Replay').should('not.exist');
  });

  it('should toggle replay mode and show indicators', () => {
    // Mock sessions
    cy.intercept('GET', `http://localhost:3001/content/${testContentId}/sessions`, {
      statusCode: 200,
      body: {
        sessions: [
          {
            id: 'session-1',
            highlightedText: 'second paragraph',
            transcript: [
              {
                userId: 'user-1',
                message: 'Great insight',
                timestamp: '2025-10-05T10:00:00Z'
              }
            ],
            participantCount: 1,
            createdAt: '2025-10-05T10:00:00Z'
          }
        ]
      }
    });

    cy.intercept('GET', '**/content*', {
      statusCode: 200,
      body: {
        data: {
          id: testContentId,
          processed_text: JSON.stringify({
            metadata: { title: 'Test Article' },
            paragraphs: [
              'First paragraph.',
              'This is the second paragraph with discussion.',
              'Third paragraph.'
            ]
          })
        }
      }
    });

    cy.visit(`/reading/${testContentId}`);

    // Enable replay mode
    cy.contains('Perspective Replay').click();

    // Indicators should appear on paragraphs with discussions
    // Hover over the paragraph to reveal the indicator
    cy.contains('second paragraph').parent().within(() => {
      // Force the hover state by triggering mouseover
      cy.get('button').should('exist');
    });
  });

  it('should open replay dialog when clicking indicator', () => {
    const mockSession = {
      id: 'session-1',
      highlightedText: 'discussed text',
      transcript: [
        {
          userId: 'user-1',
          message: 'This is fascinating!',
          timestamp: '2025-10-05T10:00:00Z'
        },
        {
          userId: 'user-2',
          message: 'Absolutely!',
          timestamp: '2025-10-05T10:01:00Z'
        }
      ],
      participantCount: 2,
      createdAt: '2025-10-05T10:00:00Z'
    };

    cy.intercept('GET', `http://localhost:3001/content/${testContentId}/sessions`, {
      statusCode: 200,
      body: { sessions: [mockSession] }
    });

    cy.intercept('GET', '**/content*', {
      statusCode: 200,
      body: {
        data: {
          id: testContentId,
          processed_text: JSON.stringify({
            metadata: { title: 'Test Article' },
            paragraphs: ['Paragraph with discussed text here.']
          })
        }
      }
    });

    cy.visit(`/reading/${testContentId}`);

    // Enable replay mode
    cy.contains('Perspective Replay').click();

    // Click the indicator (may need to hover first)
    cy.contains('discussed text').parent().within(() => {
      cy.get('button').click({ force: true });
    });

    // Dialog should open with the transcript
    cy.contains('2 readers discussed this').should('be.visible');
    cy.contains('This is fascinating!').should('be.visible');
    cy.contains('Absolutely!').should('be.visible');
  });

  it('should display "You" for current user messages in replay', () => {
    const mockSession = {
      id: 'session-1',
      highlightedText: null,
      transcript: [
        {
          userId: 'test-user-1', // This is the current user
          message: 'My message',
          timestamp: '2025-10-05T10:00:00Z'
        },
        {
          userId: 'other-user',
          message: 'Other message',
          timestamp: '2025-10-05T10:01:00Z'
        }
      ],
      participantCount: 2,
      createdAt: '2025-10-05T10:00:00Z'
    };

    cy.intercept('GET', `http://localhost:3001/content/${testContentId}/sessions`, {
      statusCode: 200,
      body: { sessions: [mockSession] }
    });

    cy.intercept('GET', '**/content*', {
      statusCode: 200,
      body: {
        data: {
          id: testContentId,
          processed_text: JSON.stringify({
            metadata: { title: 'Test Article' },
            paragraphs: ['Some content here.']
          })
        }
      }
    });

    cy.visit(`/reading/${testContentId}`);

    // Enable replay and open dialog
    cy.contains('Perspective Replay').click();
    cy.get('article').within(() => {
      cy.get('button').first().click({ force: true });
    });

    // Check that "You" appears for current user's message
    cy.contains('My message').parent().parent().within(() => {
      cy.contains('You').should('be.visible');
    });

    // Check that "Reader" appears for other user's message
    cy.contains('Other message').parent().parent().within(() => {
      cy.contains('Reader').should('be.visible');
    });
  });
});

