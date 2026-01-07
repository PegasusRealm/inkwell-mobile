import AsyncStorage from '@react-native-async-storage/async-storage';

export const createTestEntry = async () => {
  try {
    const testEntry = {
      id: `test_${Date.now()}`,
      text: 'This is a test journal entry created on January 1st, 2026. I\'m testing the Past Entries feature to see how entry cards display with all their features.',
      date: new Date('2026-01-01T10:00:00').toISOString(),
      manifestData: {
        wish: 'Test the new mobile app features',
        outcome: 'Successfully view and interact with past entries',
        opposition: 'Technical issues or bugs',
        plan: 'Click dates and review entry cards',
      },
      promptUsed: 'What are you grateful for today?',
      reflectionUsed: 'This is a test reflection from Sophy AI. It demonstrates how the reflection section appears when expanded.',
      reflectionNote: 'Testing the reflection note display',
      coachResponse: 'This is a sample practitioner response. Great work on your journaling practice!',
      newCoachReply: true,
      attachments: [],
      createdAt: new Date('2026-01-01T10:00:00').toISOString(),
    };

    const entriesJson = await AsyncStorage.getItem('journal_entries');
    const entries = entriesJson ? JSON.parse(entriesJson) : [];
    entries.push(testEntry);
    await AsyncStorage.setItem('journal_entries', JSON.stringify(entries));
    
    console.log('✅ Test entry created successfully!');
    return testEntry;
  } catch (error) {
    console.error('❌ Error creating test entry:', error);
    throw error;
  }
};

export const clearAllEntries = async () => {
  try {
    await AsyncStorage.removeItem('journal_entries');
    console.log('✅ All entries cleared!');
  } catch (error) {
    console.error('❌ Error clearing entries:', error);
    throw error;
  }
};
