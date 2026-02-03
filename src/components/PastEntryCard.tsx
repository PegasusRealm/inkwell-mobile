import React, {useState, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  Linking,
} from 'react-native';
import {spacing, borderRadius, fontFamily, fontSize} from '../theme';
import {useTheme, ThemeColors} from '../theme/ThemeContext';

interface PastEntryCardProps {
  entry: {
    id: string;
    text: string;
    date: Date;
    tags?: string[];
    manifestData?: {
      wish?: string;
      outcome?: string;
      opposition?: string;
      plan?: string;
    };
    promptUsed?: string;
    reflectionUsed?: string;
    reflectionNote?: string;
    coachResponse?: string | {text: string};
    newCoachReply?: boolean;
    attachments?: Array<{url: string; name: string}>;
  };
  onEdit?: (entryId: string) => void;
  onDelete?: (entryId: string) => void;
  onMarkAsRead?: (entryId: string) => void;
}

const PastEntryCard: React.FC<PastEntryCardProps> = ({
  entry,
  onEdit,
  onDelete,
  onMarkAsRead,
}) => {
  // Theme hook for dynamic theming
  const {colors, isDark} = useTheme();
  
  // Create styles with current theme colors
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [manifestExpanded, setManifestExpanded] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [reflectionExpanded, setReflectionExpanded] = useState(false);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this entry? This cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete?.(entry.id),
        },
      ],
    );
  };

  return (
    <View
      style={[
        styles.card,
        entry.newCoachReply && styles.cardWithNewReply,
      ]}>
      {/* New Reply Badge */}
      {entry.newCoachReply && (
        <View style={styles.newReplyBadge}>
          <Text style={styles.newReplyBadgeText}>NEW REPLY</Text>
        </View>
      )}

      {/* Date Header */}
      <Text style={styles.dateHeader}>{formatDate(entry.date)}</Text>

      {/* Tags */}
      {entry.tags && entry.tags.length > 0 && (
        <View style={styles.tagsContainer}>
          {entry.tags.map((tag, index) => (
            <View key={index} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Manifest Toggle */}
      {entry.manifestData && (
        <View style={styles.toggleSection}>
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setManifestExpanded(!manifestExpanded)}>
            <Text style={styles.toggleButtonText}>
              {manifestExpanded ? '📜 Hide Manifest' : '📜 Show Manifest'}
            </Text>
          </TouchableOpacity>
          {manifestExpanded && (
            <View style={styles.toggleContent}>
              <Text style={styles.toggleContentText}>
                <Text style={styles.bold}>Want:</Text>{' '}
                {entry.manifestData.wish || 'Not specified'}
                {'\n'}
                <Text style={styles.bold}>Imagine:</Text>{' '}
                {entry.manifestData.outcome || 'Not specified'}
                {'\n'}
                <Text style={styles.bold}>Snags:</Text>{' '}
                {entry.manifestData.opposition || 'Not specified'}
                {'\n'}
                <Text style={styles.bold}>How:</Text>{' '}
                {entry.manifestData.plan || 'Not specified'}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Prompt Toggle */}
      {entry.promptUsed && (
        <View style={styles.toggleSection}>
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setPromptExpanded(!promptExpanded)}>
            <Text style={styles.toggleButtonText}>
              {promptExpanded ? '📝 Hide Prompt' : '📝 Show Prompt'}
            </Text>
          </TouchableOpacity>
          {promptExpanded && (
            <View style={styles.toggleContent}>
              <Text style={styles.toggleContentText}>
                <Text style={styles.bold}>Prompt:</Text>{' '}
                <Text style={styles.italic}>{entry.promptUsed}</Text>
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Reflection Toggle */}
      {entry.reflectionUsed && (
        <View style={styles.toggleSection}>
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setReflectionExpanded(!reflectionExpanded)}>
            <Text style={styles.toggleButtonText}>
              {reflectionExpanded
                ? '💭 Hide Reflection'
                : '💭 Show Reflection'}
            </Text>
          </TouchableOpacity>
          {reflectionExpanded && (
            <View style={styles.toggleContent}>
              <Text style={styles.toggleContentText}>
                <Text style={styles.bold}>Sophy's Reflection:</Text>
                {'\n'}
                {entry.reflectionUsed}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Entry Text */}
      <Text style={styles.entryText}>{entry.text}</Text>

      {/* Reflection Note */}
      {entry.reflectionNote && (
        <View style={styles.reflectionNote}>
          <Text style={styles.reflectionNoteText}>
            🧠 <Text style={styles.bold}>Reflection:</Text>{' '}
            {entry.reflectionNote}
          </Text>
        </View>
      )}

      {/* Coach Response */}
      {entry.coachResponse && (
        <View
          style={[
            styles.coachResponse,
            entry.newCoachReply && styles.coachResponseNew,
          ]}>
          <Text style={styles.coachResponseTitle}>
            {entry.newCoachReply ? '💬 New Coach Reply' : '💬 Coach Reply'}
          </Text>
          <Text style={styles.coachResponseText}>
            {typeof entry.coachResponse === 'string'
              ? entry.coachResponse
              : entry.coachResponse.text}
          </Text>
          {entry.newCoachReply && onMarkAsRead && (
            <TouchableOpacity
              style={styles.markReadButton}
              onPress={() => onMarkAsRead(entry.id)}>
              <Text style={styles.markReadButtonText}>✓ Mark as Read</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Attachments Preview */}
      {entry.attachments && entry.attachments.length > 0 && (
        <View style={styles.attachmentsSection}>
          <Text style={styles.attachmentsTitle}>
            📎 {entry.attachments.length} attachment(s)
          </Text>
          <View style={styles.attachmentThumbnails}>
            {entry.attachments.slice(0, 4).map((file, index) => {
              const ext = file.url?.split('.').pop()?.toLowerCase();
              const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext || '');
              
              return isImage ? (
                <TouchableOpacity
                  key={index}
                  onPress={() => Linking.openURL(file.url)}>
                  <Image
                    source={{uri: file.url}}
                    style={styles.thumbnail}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  key={index}
                  style={styles.filePlaceholder}
                  onPress={() => Linking.openURL(file.url)}>
                  <Text style={styles.fileIcon}>📄</Text>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {file.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {entry.attachments.length > 4 && (
              <View style={styles.moreFilesIndicator}>
                <Text style={styles.moreFilesText}>+{entry.attachments.length - 4}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actions}>
        {onEdit && (
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => onEdit(entry.id)}>
            <Text style={styles.actionButtonText}>✏️ Edit</Text>
          </TouchableOpacity>
        )}
        {onDelete && (
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={handleDelete}>
            <Text style={styles.actionButtonText}>🗑️ Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// Dynamic styles based on theme colors
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.brandPrimary,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  cardWithNewReply: {
    borderLeftWidth: 5,
    borderLeftColor: colors.sophyAccent,
    shadowColor: colors.sophyAccent,
    shadowOpacity: 0.2,
  },
  newReplyBadge: {
    position: 'absolute',
    top: -8,
    right: spacing.md,
    backgroundColor: colors.sophyAccent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: colors.sophyAccent,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  newReplyBadgeText: {
    color: colors.fontWhite,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.buttonBold,
    letterSpacing: 0.5,
  },
  dateHeader: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.header,
    color: colors.brandPrimary,
    marginBottom: spacing.sm,
  },
  toggleSection: {
    marginBottom: spacing.sm,
  },
  toggleButton: {
    backgroundColor: 'transparent',
    paddingVertical: 4,
    marginBottom: 4,
  },
  toggleButtonText: {
    color: colors.brandPrimary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.buttonBold,
  },
  toggleContent: {
    backgroundColor: colors.bgSection,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.brandPrimary,
    marginTop: 4,
  },
  toggleContentText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.body,
    color: colors.fontMain,
    lineHeight: 20,
  },
  bold: {
    fontFamily: fontFamily.bodyBold,
  },
  italic: {
    fontStyle: 'italic',
  },
  entryText: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.body,
    color: colors.fontMain,
    lineHeight: 24,
    marginBottom: spacing.md,
  },
  reflectionNote: {
    backgroundColor: colors.bgSection,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.brandLight,
    marginBottom: spacing.sm,
  },
  reflectionNoteText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.body,
    color: colors.fontSecondary,
    lineHeight: 20,
  },
  coachResponse: {
    backgroundColor: colors.bgSection,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.brandSecondary,
    marginBottom: spacing.sm,
  },
  coachResponseNew: {
    borderLeftWidth: 4,
    borderLeftColor: colors.tierConnect,
  },
  coachResponseTitle: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.header,
    color: colors.fontMain,
    marginBottom: spacing.xs,
  },
  coachResponseText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.body,
    color: colors.fontMain,
    lineHeight: 20,
  },
  markReadButton: {
    backgroundColor: colors.brandPrimary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  markReadButtonText: {
    color: colors.fontWhite,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.buttonBold,
  },
  attachmentsSection: {
    marginBottom: spacing.sm,
  },
  attachmentsTitle: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.body,
    color: colors.fontMuted,
    fontStyle: 'italic',
    marginBottom: spacing.xs,
  },
  attachmentThumbnails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.bgMuted,
  },
  filePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.bgSection,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  fileIcon: {
    fontSize: fontSize.xxl,
  },
  fileName: {
    fontSize: 8,
    fontFamily: fontFamily.body,
    color: colors.fontMuted,
    marginTop: 2,
    textAlign: 'center',
    maxWidth: 58,
  },
  moreFilesIndicator: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.brandPrimaryRgba,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.brandPrimary,
  },
  moreFilesText: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.buttonBold,
    color: colors.brandPrimary,
  },
  actions: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: colors.brandPrimary,
  },
  deleteButton: {
    backgroundColor: colors.fontMuted,
  },
  actionButtonText: {
    color: colors.fontWhite,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.buttonBold,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  tag: {
    backgroundColor: colors.brandPrimaryRgba,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.brandPrimary + '33',
  },
  tagText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.buttonBold,
    color: colors.brandPrimary,
  },
});

export default PastEntryCard;
