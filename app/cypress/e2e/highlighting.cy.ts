describe('Text Highlighting Journey', () => {
  beforeEach(() => {
    // Mock authenticated user session
    cy.session('user-session', () => {
      cy.visit('/');
      // Mock Supabase auth session
      cy.window().then((win) => {
        win.localStorage.setItem('supabase.auth.token', JSON.stringify({
          currentSession: {
            access_token: 'mock-token',
            user: { id: 'test-user-id' }
          }
        }));
      });
    });
  });

  it('allows user to highlight text and save it successfully', () => {
    // Mock the reading page content fetch
    cy.intercept('GET', '**/rest/v1/content?*', {
      statusCode: 200,
      body: [{
        id: 'test-content-id',
        processed_text: 'This is a sample article about artificial intelligence. AI is transforming the world in many ways. Machine learning enables computers to learn from data.',
        source_type: 'url',
        source_info: 'https://example.com/article',
        created_at: new Date().toISOString(),
      }],
    }).as('getContent');

    // Mock the highlights POST endpoint
    cy.intercept('POST', 'http://localhost:3001/highlights', {
      statusCode: 200,
      body: { success: true, highlightId: 'test-highlight-id' },
    }).as('saveHighlight');

    // Navigate to reading page
    cy.visit('/reading/test-content-id');
    cy.wait('@getContent');

    // Verify content is displayed
    cy.contains('This is a sample article').should('be.visible');

    // Simulate text selection
    // Note: Cypress doesn't have native text selection, so we use a workaround
    cy.get('#content-text').then(($content) => {
      const content = $content[0];
      const range = document.createRange();
      const selection = window.getSelection();
      
      // Select the text "artificial intelligence"
      const textNode = content.childNodes[0];
      range.setStart(textNode, 28);
      range.setEnd(textNode, 52);
      
      selection?.removeAllRanges();
      selection?.addRange(range);
      
      // Trigger mouseup event to show popover
      cy.get('#content-text').trigger('mouseup');
    });

    // Verify "Discuss this" button appears
    cy.contains('button', 'Discuss this').should('be.visible');

    // Click the "Discuss this" button
    cy.contains('button', 'Discuss this').click();

    // Wait for the highlights API call
    cy.wait('@saveHighlight').then((interception) => {
      // Verify the request body contains correct data
      expect(interception.request.body).to.have.property('contentId', 'test-content-id');
      expect(interception.request.body).to.have.property('text', 'artificial intelligence');
      expect(interception.request.body).to.have.property('userId', 'test-user-id');
      expect(interception.request.body).to.have.property('context');
    });

    // Verify success (button should disappear after saving)
    cy.contains('button', 'Discuss this').should('not.exist');
  });

  it('does not show discuss button when no text is selected', () => {
    cy.intercept('GET', '**/rest/v1/content?*', {
      statusCode: 200,
      body: [{
        id: 'test-content-id',
        processed_text: 'This is a sample article',
        source_type: 'url',
        source_info: 'https://example.com',
        created_at: new Date().toISOString(),
      }],
    });

    cy.visit('/reading/test-content-id');

    // Click on the content without selecting text
    cy.get('#content-text').click();

    // Verify "Discuss this" button does not appear
    cy.contains('button', 'Discuss this').should('not.exist');
  });

  it('handles API errors gracefully', () => {
    cy.intercept('GET', '**/rest/v1/content?*', {
      statusCode: 200,
      body: [{
        id: 'test-content-id',
        processed_text: 'Sample text for error testing',
        source_type: 'url',
        source_info: 'https://example.com',
        created_at: new Date().toISOString(),
      }],
    });

    // Mock the highlights endpoint to return an error
    cy.intercept('POST', 'http://localhost:3001/highlights', {
      statusCode: 500,
      body: { error: 'Database error' },
    }).as('saveHighlightError');

    cy.visit('/reading/test-content-id');

    // Select text
    cy.get('#content-text').then(($content) => {
      const content = $content[0];
      const range = document.createRange();
      const selection = window.getSelection();
      
      const textNode = content.childNodes[0];
      range.setStart(textNode, 0);
      range.setEnd(textNode, 11);
      
      selection?.removeAllRanges();
      selection?.addRange(range);
      
      cy.get('#content-text').trigger('mouseup');
    });

    // Click discuss button
    cy.contains('button', 'Discuss this').click();

    // Wait for the failed API call
    cy.wait('@saveHighlightError');

    // The popover should still close (based on current implementation)
    // In a real app, you might want to show an error message
    cy.contains('button', 'Discuss this').should('not.exist');
  });

  it('complete journey: submit URL -> navigate to reading -> highlight -> save', () => {
    // Start from dashboard
    cy.visit('/dashboard');

    // Mock URL submission
    cy.intercept('POST', 'http://localhost:3001/content/url', {
      statusCode: 200,
      body: { success: true, contentId: 'new-content-id' },
    }).as('submitUrl');

    // Submit a URL
    cy.get('input[placeholder="Enter URL"]').type('https://example.com/article');
    cy.contains('button', 'Submit URL').click();

    cy.wait('@submitUrl');

    // Should navigate to reading page
    cy.url().should('include', '/reading/new-content-id');

    // Mock content fetch
    cy.intercept('GET', '**/rest/v1/content?*', {
      statusCode: 200,
      body: [{
        id: 'new-content-id',
        processed_text: 'This is the complete journey test. We are testing the full flow from URL submission to highlighting.',
        source_type: 'url',
        source_info: 'https://example.com/article',
        created_at: new Date().toISOString(),
      }],
    });

    // Reload to fetch content
    cy.reload();

    // Verify content loads
    cy.contains('This is the complete journey test').should('be.visible');

    // Mock highlight save
    cy.intercept('POST', 'http://localhost:3001/highlights', {
      statusCode: 200,
      body: { success: true, highlightId: 'highlight-id' },
    }).as('saveHighlight');

    // Select and highlight text
    cy.get('#content-text').then(($content) => {
      const content = $content[0];
      const range = document.createRange();
      const selection = window.getSelection();
      
      const textNode = content.childNodes[0];
      range.setStart(textNode, 0);
      range.setEnd(textNode, 32);
      
      selection?.removeAllRanges();
      selection?.addRange(range);
      
      cy.get('#content-text').trigger('mouseup');
    });

    // Save highlight
    cy.contains('button', 'Discuss this').click();
    cy.wait('@saveHighlight');

    // Verify success
    cy.contains('button', 'Discuss this').should('not.exist');
  });
});
