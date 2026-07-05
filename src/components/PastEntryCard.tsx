/**
 * PastEntryCard — v2 rebuild (M2 Entries slice, 2026-07-04)
 * The entry card: the person's words in serif, structure in teal,
 * Sophy's reflection wears coral (her content, her color).
 * Connect is dead — coach response block, NEW REPLY badge, and
 * mark-as-read removed (2026-07-04).
 */
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
import {Card, IWButton} from './kit';

interface PastEntryCardProps {
  entry: {
    id: string;
    text: string;
    date: Date;
    title?: string;
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
    attachments?: Array<{url: string; name: string}>;
  };
  onEdit?: (entryId: string) => void;
  onDelete?: (entryId: string) => void;
}

const PastEntryCard: React.FC<PastEntryCardProps> = ({entry, onEdit, onDelete}) => {
  const {colors} = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [manifestExpanded, setManifestExpanded] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [reflectionExpanded, setReflectionExpanded] = useState(false);

  const formatDate = (date: Date) => {
    return date
      .toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
      .toUpperCase();
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
    <Card style={styles.card}>
      {/* Date line — caps, quiet */}
      <Text style={styles.dateLine}>{formatDate(entry.date)}</Text>

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

      {/* The entry — the person's words own the card */}
      <Text style={styles.entryText}>{entry.text}</Text>

      {/* Manifest toggle — structure, teal */}
      {entry.manifestData && (
        <View style={styles.toggleSection}>
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setManifestExpanded(!manifestExpanded)}>
            <Text style={styles.toggleButtonText}>
              {manifestExpanded ? 'Hide goal snapshot' : 'Show goal snapshot'}
            </Text>
          </TouchableOpacity>
          {manifestExpanded && (
            <View style={styles.toggleContent}>
              <Text style={styles.toggleContentText}>
                <Text style={styles.bold}>Want:</Text> {entry.manifestData.wish || 'Not specified'}
                {'\n'}
                <Text style={styles.bold}>Imagine:</Text> {entry.manifestData.outcome || 'Not specified'}
                {'\n'}
                <Text style={styles.bold}>Snags:</Text> {entry.manifestData.opposition || 'Not specified'}
                {'\n'}
                <Text style={styles.bold}>How:</Text> {entry.manifestData.plan || 'Not specified'}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Prompt toggle — structure, teal */}
      {entry.promptUsed && (
        <View style={styles.toggleSection}>
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setPromptExpanded(!promptExpanded)}>
            <Text style={styles.toggleButtonText}>
              {promptExpanded ? 'Hide prompt' : 'Show prompt'}
            </Text>
          </TouchableOpacity>
          {promptExpanded && (
            <View style={styles.toggleContent}>
              <Text style={styles.promptText}>{entry.promptUsed}</Text>
            </View>
          )}
        </View>
      )}

      {/* Sophy's reflection toggle — HER content, coral */}
      {entry.reflectionUsed && (
        <View style={styles.toggleSection}>
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setReflectionExpanded(!reflectionExpanded)}>
            <Text style={styles.sophyToggleText}>
              {reflectionExpanded ? "Hide Sophy's reflection" : "Show Sophy's reflection"}
            </Text>
          </TouchableOpacity>
          {reflectionExpanded && (
            <View style={styles.sophyContent}>
              <Text style={styles.sophyWho}>SOPHY</Text>
              <Text style={styles.sophyText}>{entry.reflectionUsed}</Text>
            </View>
          )}
        </View>
      )}

      {/* Reflection note (legacy field) */}
      {entry.reflectionNote && (
        <View style={styles.sophyContent}>
          <Text style={styles.sophyWho}>SOPHY</Text>
          <Text style={styles.sophyText}>{entry.reflectionNote}</Text>
        </View>
      )}

      {/* Attachments */}
      {entry.attachments && entry.attachments.length > 0 && (
        <View style={styles.attachmentsSection}>
          <Text style={styles.attachmentsTitle}>
            {entry.attachments.length} attachment{entry.attachments.length === 1 ? '' : 's'}
          </Text>
          <View style={styles.attachmentThumbnails}>
            {entry.attachments.slice(0, 4).map((file, index) => {
              const ext = file.url?.split('.').pop()?.toLowerCase();
              const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext || '');

              return isImage ? (
                <TouchableOpacity key={index} onPress={() => Linking.openURL(file.url)}>
                  <Image source={{uri: file.url}} style={styles.thumbnail} resizeMode="cover" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  key={index}
                  style={styles.filePlaceholder}
                  onPress={() => Linking.openURL(file.url)}>
                  <Text style={styles.fileIcon}>FILE</Text>
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

      {/* Actions — quiet */}
      <View style={styles.actions}>
        {onEdit && <IWButton voice="gray" small title="Edit" onPress={() => onEdit(entry.id)} />}
        {onDelete && <IWButton voice="gray" small title="Delete" onPress={handleDelete} />}
      </View>
    </Card>
  );
};

// Dynamic styles based on theme colors
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      marginBottom: spacing.lg,
    },
    dateLine: {
      fontFamily: fontFamily.bodyBold,
      fontSize: fontSize.xs,
      color: colors.brandPrimary,
      letterSpacing: 1.5,
      marginBottom: spacing.sm,
    },
    tagsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    tag: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderMedium,
    },
    tagText: {
      fontFamily: fontFamily.button,
      fontSize: fontSize.xs,
      color: colors.fontSecondary,
    },
    entryText: {
      fontFamily: fontFamily.serif,
      fontSize: fontSize.md,
      color: colors.fontMain,
      lineHeight: fontSize.md * 1.65,
      marginBottom: spacing.md,
    },
    toggleSection: {
      marginBottom: spacing.sm,
    },
    toggleButton: {
      paddingVertical: 4,
      minHeight: 40,
      justifyContent: 'center',
    },
    toggleButtonText: {
      color: colors.brandPrimary,
      fontSize: fontSize.sm,
      fontFamily: fontFamily.buttonBold,
    },
    sophyToggleText: {
      color: colors.sophyAccent,
      fontSize: fontSize.sm,
      fontFamily: fontFamily.buttonBold,
    },
    toggleContent: {
      backgroundColor: colors.bgSection,
      padding: spacing.sm,
      borderRadius: borderRadius.sm,
      borderLeftWidth: 3,
      borderLeftColor: colors.brandPrimary,
      marginTop: 4,
    },
    toggleContentText: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.body,
      color: colors.fontMain,
      lineHeight: 20,
    },
    promptText: {
      fontFamily: fontFamily.serifItalic,
      fontStyle: 'italic',
      fontSize: fontSize.sm,
      color: colors.fontMain,
      lineHeight: 20,
    },
    bold: {
      fontFamily: fontFamily.bodyBold,
    },
    // Sophy surfaces — coral only, her words serif italic
    sophyContent: {
      backgroundColor: colors.sophyTint,
      borderWidth: 1,
      borderColor: colors.sophyBorder,
      padding: spacing.sm,
      borderRadius: borderRadius.md,
      marginTop: 4,
      marginBottom: spacing.sm,
    },
    sophyWho: {
      fontFamily: fontFamily.bodyBold,
      fontSize: 10,
      letterSpacing: 2,
      color: colors.sophyLight,
      marginBottom: 2,
    },
    sophyText: {
      fontFamily: fontFamily.serifItalic,
      fontStyle: 'italic',
      fontSize: fontSize.sm,
      color: colors.fontMain,
      lineHeight: 20,
    },
    attachmentsSection: {
      marginBottom: spacing.sm,
    },
    attachmentsTitle: {
      fontSize: fontSize.xs,
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
      fontFamily: fontFamily.bodyBold,
      fontSize: fontSize.xs,
      color: colors.fontMuted,
      letterSpacing: 1,
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
      backgroundColor: colors.bgMuted,
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
      justifyContent: 'flex-end',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
  });

export default PastEntryCard;
