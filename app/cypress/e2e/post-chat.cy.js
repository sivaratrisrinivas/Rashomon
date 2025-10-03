describe('Post-Chat Invite', () => {
    beforeEach(() => {
      // Intercept Supabase auth
      cy.intercept('GET', '**/auth/v1/session', {
        statusCode: 200,
        body: {
          data: {
            session: {
              user: { id: 'test-user-id', email: 'test@example.com' },
              access_token: 'mock-token',
            },
          },
        },
      });

      // Intercept content fetch
      cy.intercept('GET', '**/rest/v1/content?id=eq.test-content-id*', {
        statusCode: 200,
        body: [
          {
            id: 'test-content-id',
            processed_text: JSON.stringify({
              metadata: { title: 'Test Content' },
              paragraphs: ['Test paragraph'],
            }),
          },
        ],
      });

      // Intercept invites endpoint
      cy.intercept('POST', 'http://localhost:3001/invites', {
        statusCode: 200,
        body: { link: 'https://your-app.com/invite/test-invite-code' },
      }).as('createInvite');
    });

    it('shows modal and generates invite when timer ends', () => {
      cy.visit('/chat/test-content-id');

      // Wait for page to load
      cy.contains('Discussion').should('be.visible');

      // Mock the timer ending by manipulating state
      cy.window().then((win) => {
        // Trigger the modal by setting timeLeft to 0
        const event = new CustomEvent('timerEnd');
        win.dispatchEvent(event);
      });

      // Alternative: Use cy.clock to fast-forward time
      cy.clock();
      cy.tick(300000); // 5 minutes in milliseconds

      // Verify modal appears
      cy.get('[data-testid="aha-modal"]', { timeout: 10000 }).should('be.visible');
      cy.contains('Great conversation!').should('be.visible');
      cy.contains('aha moment').should('be.visible');

      // Click "Yes, send invite!" button
      cy.get('[data-testid="yes-invite-button"]').click();

      // Verify API call was made
      cy.wait('@createInvite').its('request.body').should('deep.include', {
        sessionId: Cypress.sinon.match.string,
      });

      // Verify invite link is displayed
      cy.get('[data-testid="invite-link"]')
        .should('be.visible')
        .and('contain', 'invite');
    });
  });