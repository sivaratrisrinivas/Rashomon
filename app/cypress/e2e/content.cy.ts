describe('Content Processing', () => {
  beforeEach(() => {
    // Mock authenticated user session
    cy.session('user-session', () => {
      cy.visit('/login');
      // This assumes you have a way to programmatically log in
      // You may need to adjust based on your auth setup
    });
  });

  it('processes URL and displays content', () => {
    cy.visit('/dashboard');

    // Intercept the API call to the backend
    cy.intercept('POST', 'http://localhost:3001/content/url', {
      statusCode: 200,
      body: { success: true, contentId: 'test-content-id' },
    }).as('urlSubmit');

    // Enter URL and submit
    cy.get('input[placeholder="Enter URL"]').type('https://example.com');
    cy.contains('button', 'Submit URL').click();

    // Wait for API call
    cy.wait('@urlSubmit');

    // Should redirect to reading page
    cy.url().should('include', '/reading/test-content-id');

    // Mock the reading page data
    cy.intercept('GET', '**/rest/v1/content?*', {
      statusCode: 200,
      body: [{
        id: 'test-content-id',
        processed_text: 'This is the extracted text from the URL',
        source_type: 'url',
        source_info: 'https://example.com',
        created_at: new Date().toISOString(),
      }],
    });

    // Verify content is displayed
    cy.contains('This is the extracted text from the URL').should('be.visible');
    cy.contains('Source: URL').should('be.visible');
  });

  it('uploads file and displays OCR content', () => {
    cy.visit('/dashboard');

    // Mock Supabase Storage upload
    cy.intercept('POST', '**/storage/v1/object/uploads/**', {
      statusCode: 200,
      body: { Key: 'test-user-id/test-image.png' },
    }).as('fileUpload');

    // Mock backend OCR processing
    cy.intercept('POST', 'http://localhost:3001/content/upload', {
      statusCode: 200,
      body: { success: true, contentId: 'test-upload-id' },
    }).as('uploadProcess');

    // Upload file
    cy.get('input[type="file"]').selectFile('cypress/fixtures/test-image.png', { force: true });
    cy.contains('button', 'Upload File').click();

    // Wait for both API calls
    cy.wait('@fileUpload');
    cy.wait('@uploadProcess');

    // Should redirect to reading page
    cy.url().should('include', '/reading/test-upload-id');

    // Mock the reading page data
    cy.intercept('GET', '**/rest/v1/content?*', {
      statusCode: 200,
      body: [{
        id: 'test-upload-id',
        processed_text: 'This is the OCR extracted text from the image',
        source_type: 'upload',
        source_info: 'test-user-id/test-image.png',
        created_at: new Date().toISOString(),
      }],
    });

    // Verify OCR content is displayed
    cy.contains('This is the OCR extracted text from the image').should('be.visible');
    cy.contains('Source: Upload').should('be.visible');
  });
});


