/// Format duration in seconds to human-readable string.
///
/// Examples: 3661 → "1h 1m", 120 → "2m", 7200 → "2h", 0 → "0m"
String formatDuration(int totalSecs) {
  if (totalSecs <= 0) return '0m';
  final h = totalSecs ~/ 3600;
  final m = (totalSecs % 3600) ~/ 60;

  if (h > 0 && m > 0) return '${h}h ${m}m';
  if (h > 0) return '${h}h';
  return '${m}m';
}

/// Format a DateTime to relative string ("Today", "Yesterday", "Apr 15").
String formatRelativeDate(DateTime date) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final dateOnly = DateTime(date.year, date.month, date.day);
  final diff = today.difference(dateOnly).inDays;

  if (diff == 0) return 'Today';
  if (diff == 1) return 'Yesterday';

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return '${months[date.month - 1]} ${date.day}';
}

/// Format time of day: "10:30 AM"
String formatTime(DateTime date) {
  final h = date.hour;
  final m = date.minute.toString().padLeft(2, '0');
  final period = h >= 12 ? 'PM' : 'AM';
  final h12 = h == 0 ? 12 : (h > 12 ? h - 12 : h);
  return '$h12:$m $period';
}
