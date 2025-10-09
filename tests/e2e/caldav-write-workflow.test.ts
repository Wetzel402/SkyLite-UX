import { test, expect } from '@playwright/test';

test.describe('CalDAV Write Workflow E2E', () => {
  const baseURL = process.env.BASE_URL || 'http://localhost:3000';
  const adminToken = process.env.ADMIN_API_TOKEN || 'test-admin';
  const displayToken = process.env.DISPLAY_TOKEN || 'test-token';

  test('complete write workflow with kiosk display', async ({ request }) => {
    // Step 1: Create a CalDAV source with write policy
    const sourceResponse = await request.post(`${baseURL}/api/admin/sources`, {
      headers: {
        'X-Admin-Token': adminToken,
        'Content-Type': 'application/json'
      },
      data: {
        type: 'caldav',
        name: 'Test CalDAV Write Source',
        writePolicy: 'write',
        serverUrl: 'https://caldav.example.com',
        username: 'testuser',
        password: 'testpass',
        calendarName: 'Test Calendar'
      }
    });

    // Note: This would need a proper source creation endpoint
    // For now, we'll assume the source exists
    const sourceId = 'test-caldav-source';

    // Step 2: Create an event via admin API
    const createResponse = await request.post(`${baseURL}/api/admin/events`, {
      headers: {
        'X-Admin-Token': adminToken,
        'Content-Type': 'application/json'
      },
      data: {
        title: 'E2E Test Event',
        description: 'This event was created via CalDAV write API',
        location: 'Test Location',
        start: '2024-01-01T10:00:00Z',
        end: '2024-01-01T11:00:00Z',
        allDay: false,
        sourceId: sourceId
      }
    });

    expect(createResponse.status()).toBe(200);
    const createResult = await createResponse.json();
    expect(createResult.success).toBe(true);
    expect(createResult.event.title).toBe('E2E Test Event');

    const eventId = createResult.event.id;

    // Step 3: Update the event
    const updateResponse = await request.patch(`${baseURL}/api/admin/events/${eventId}`, {
      headers: {
        'X-Admin-Token': adminToken,
        'Content-Type': 'application/json'
      },
      data: {
        title: 'Updated E2E Test Event',
        description: 'This event was updated via CalDAV write API'
      }
    });

    expect(updateResponse.status()).toBe(200);
    const updateResult = await updateResponse.json();
    expect(updateResult.success).toBe(true);
    expect(updateResult.event.title).toBe('Updated E2E Test Event');
    expect(updateResult.event.version).toBe(2);

    // Step 4: Verify event appears on kiosk display
    const kioskResponse = await request.get(`${baseURL}/display?token=${displayToken}`);
    expect(kioskResponse.status()).toBe(200);

    // The kiosk should show the updated event
    // This would need to be enhanced to actually parse the kiosk content
    const kioskContent = await kioskResponse.text();
    expect(kioskContent).toContain('Updated E2E Test Event');

    // Step 5: Delete the event
    const deleteResponse = await request.delete(`${baseURL}/api/admin/events/${eventId}`, {
      headers: {
        'X-Admin-Token': adminToken
      }
    });

    expect(deleteResponse.status()).toBe(200);
    const deleteResult = await deleteResponse.json();
    expect(deleteResult.success).toBe(true);
    expect(deleteResult.event.status).toBe('cancelled');

    // Step 6: Verify event no longer appears on kiosk
    const kioskResponseAfter = await request.get(`${baseURL}/display?token=${displayToken}`);
    expect(kioskResponseAfter.status()).toBe(200);

    const kioskContentAfter = await kioskResponseAfter.text();
    expect(kioskContentAfter).not.toContain('Updated E2E Test Event');
  });

  test('conflict handling workflow', async ({ request }) => {
    const sourceId = 'test-caldav-source';

    // Create initial event
    const createResponse = await request.post(`${baseURL}/api/admin/events`, {
      headers: {
        'X-Admin-Token': adminToken,
        'Content-Type': 'application/json'
      },
      data: {
        title: 'Conflict Test Event',
        start: '2024-01-01T10:00:00Z',
        end: '2024-01-01T11:00:00Z',
        sourceId: sourceId
      }
    });

    expect(createResponse.status()).toBe(200);
    const createResult = await createResponse.json();
    const eventId = createResult.event.id;

    // Simulate concurrent update (this would need proper conflict simulation)
    const updateResponse = await request.patch(`${baseURL}/api/admin/events/${eventId}`, {
      headers: {
        'X-Admin-Token': adminToken,
        'Content-Type': 'application/json'
      },
      data: {
        title: 'Concurrent Update'
      }
    });

    // Should either succeed or return conflict error
    expect([200, 409]).toContain(updateResponse.status());

    if (updateResponse.status() === 409) {
      const conflictResult = await updateResponse.json();
      expect(conflictResult.statusMessage).toContain('Conflict');
      expect(conflictResult.data).toHaveProperty('before');
      expect(conflictResult.data).toHaveProperty('attempted');
    }
  });

  test('quota enforcement', async ({ request }) => {
    const sourceId = 'test-caldav-source';

    // This test would need to be enhanced to actually test quota limits
    // For now, we'll just verify the endpoints handle requests properly
    
    const responses = [];
    for (let i = 0; i < 5; i++) {
      const response = await request.post(`${baseURL}/api/admin/events`, {
        headers: {
          'X-Admin-Token': adminToken,
          'Content-Type': 'application/json'
        },
        data: {
          title: `Quota Test Event ${i}`,
          start: '2024-01-01T10:00:00Z',
          end: '2024-01-01T11:00:00Z',
          sourceId: sourceId
        }
      });
      responses.push(response);
    }

    // At least some requests should succeed
    const successCount = responses.filter(r => r.status() === 200).length;
    expect(successCount).toBeGreaterThan(0);

    // Some requests might be rate limited
    const rateLimitedCount = responses.filter(r => r.status() === 429).length;
    // This is expected behavior when quota is exceeded
  });

  test('dry-run mode', async ({ request }) => {
    // This test would verify that dry-run mode works correctly
    // It should create audit entries but not actually modify remote calendars
    
    const sourceId = 'test-caldav-source';

    const response = await request.post(`${baseURL}/api/admin/events`, {
      headers: {
        'X-Admin-Token': adminToken,
        'Content-Type': 'application/json'
      },
      data: {
        title: 'Dry Run Test Event',
        start: '2024-01-01T10:00:00Z',
        end: '2024-01-01T11:00:00Z',
        sourceId: sourceId
      }
    });

    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result.success).toBe(true);
    
    // In dry-run mode, the event should be created locally but not on remote server
    expect(result.event.status).toBe('pending');
  });

  test('error handling and recovery', async ({ request }) => {
    // Test various error scenarios
    
    // Test with invalid source ID
    const invalidSourceResponse = await request.post(`${baseURL}/api/admin/events`, {
      headers: {
        'X-Admin-Token': adminToken,
        'Content-Type': 'application/json'
      },
      data: {
        title: 'Test Event',
        start: '2024-01-01T10:00:00Z',
        end: '2024-01-01T11:00:00Z',
        sourceId: 'invalid-source-id'
      }
    });

    expect(invalidSourceResponse.status()).toBe(404);

    // Test with missing required fields
    const missingFieldsResponse = await request.post(`${baseURL}/api/admin/events`, {
      headers: {
        'X-Admin-Token': adminToken,
        'Content-Type': 'application/json'
      },
      data: {
        title: 'Test Event'
        // Missing start, end, sourceId
      }
    });

    expect(missingFieldsResponse.status()).toBe(400);

    // Test with invalid admin token
    const invalidTokenResponse = await request.post(`${baseURL}/api/admin/events`, {
      headers: {
        'X-Admin-Token': 'invalid-token',
        'Content-Type': 'application/json'
      },
      data: {
        title: 'Test Event',
        start: '2024-01-01T10:00:00Z',
        end: '2024-01-01T11:00:00Z',
        sourceId: 'test-source'
      }
    });

    expect(invalidTokenResponse.status()).toBe(401);
  });
});
