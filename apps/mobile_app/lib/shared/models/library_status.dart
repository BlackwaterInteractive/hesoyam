/// Status of a game in a user's library.
///
/// Values match the `user_game_library.status` CHECK constraint in the DB:
///   status IN ('want_to_play', 'played', 'completed')
enum LibraryStatus {
  wantToPlay('want_to_play', 'Want to Play'),
  played('played', 'Played'),
  completed('completed', 'Completed');

  const LibraryStatus(this.value, this.label);

  /// DB column value — what gets written to `user_game_library.status`.
  final String value;

  /// User-facing label — what appears in the UI.
  final String label;

  static LibraryStatus fromValue(String value) =>
      LibraryStatus.values.firstWhere(
        (s) => s.value == value,
        orElse: () => LibraryStatus.played,
      );
}
