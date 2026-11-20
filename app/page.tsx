'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { supabase } from '../lib/supabase';

interface League {
  id: string;
  name: string;
  sport: string;
  season: string;
  logo_url?: string;
}

interface Team {
  id: string;
  name: string;
  logo_url?: string;
  theme_mode?: 'dark' | 'light';
  primary_color?: string;
  secondary_color?: string;
  bg_color?: string;
  text_color?: string;
}

interface Player {
  id: string;
  team_id: string;
  name: string;
  number?: number;
  position?: string;
}

interface PlayerStat {
  id?: string;
  match_id: string;
  player_id: string;
  team_id: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  player?: Player;
}

interface Match {
  id: string;
  league_id: string;
  round?: string;
  home_team_id: string;
  away_team_id: string;
  match_date: string;
  status: 'scheduled' | 'live' | 'finished';
  home_score: number;
  away_score: number;
  home_team?: { name: string };
  away_team?: { name: string };
}

function HomeContent() {
  // Authentication State
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [leagues, setLeagues] = useState<League[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [leagueTeamMap, setLeagueTeamMap] = useState<{ league_id: string; team_id: string }[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeLeagueId, setActiveLeagueId] = useState<string | null>(null);

  // League Form State
  const [leagueName, setLeagueName] = useState('');
  const [leagueLogoUrl, setLeagueLogoUrl] = useState('');
  const [sport, setSport] = useState('football');
  const [season, setSeason] = useState('2025-2026');
  const [creatingLeague, setCreatingLeague] = useState(false);

  // League Edit State
  const [editingLeagueId, setEditingLeagueId] = useState<string | null>(null);
  const [editingLeagueName, setEditingLeagueName] = useState('');
  const [editingLeagueLogoUrl, setEditingLeagueLogoUrl] = useState('');
  const [savingLeague, setSavingLeague] = useState(false);

  // Team Form State
  const [teamName, setTeamName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [selectedExistingTeamId, setSelectedExistingTeamId] = useState('');
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [primaryColor, setPrimaryColor] = useState('#0284c7');
  const [secondaryColor, setSecondaryColor] = useState('#0f172a');
  const [bgColor, setBgColor] = useState('#090d16');
  const [textColor, setTextColor] = useState('#ffffff');
  const [creatingTeam, setCreatingTeam] = useState(false);

  // Team Editing State
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingTeamName, setEditingTeamName] = useState('');
  const [editingLogoUrl, setEditingLogoUrl] = useState('');
  const [editingThemeMode, setEditingThemeMode] = useState<'dark' | 'light'>('dark');
  const [editingPrimaryColor, setEditingPrimaryColor] = useState('#0284c7');
  const [editingSecondaryColor, setEditingSecondaryColor] = useState('#0f172a');
  const [editingBgColor, setEditingBgColor] = useState('#090d16');
  const [editingTextColor, setEditingTextColor] = useState('#ffffff');
  const [savingTeam, setSavingTeam] = useState(false);

  // Roster Management State
  const [activeTeamRoster, setActiveTeamRoster] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerName, setPlayerName] = useState('');
  const [playerNumber, setPlayerNumber] = useState('');

  // Match Form State
  const [matchRound, setMatchRound] = useState('Round 1');
  const [homeTeamId, setHomeTeamId] = useState('');
  const [awayTeamId, setAwayTeamId] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [creatingMatch, setCreatingMatch] = useState(false);

  // Match Edit State (Round & Date)
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [editingMatchRound, setEditingMatchRound] = useState('');
  const [editingMatchDate, setEditingMatchDate] = useState('');
  const [savingMatchDetails, setSavingMatchDetails] = useState(false);

  // Box Score Editor State
  const [editingBoxScoreMatch, setEditingBoxScoreMatch] = useState<Match | null>(null);
  const [boxScoreStats, setBoxScoreStats] = useState<Record<string, PlayerStat>>({});
  const [matchPlayersHome, setMatchPlayersHome] = useState<Player[]>([]);
  const [matchPlayersAway, setMatchPlayersAway] = useState<Player[]>([]);
  const [savingBoxScore, setSavingBoxScore] = useState(false);

  const fetchData = async () => {
    const { data: leagueData } = await supabase
      .from('leagues')
      .select('*')
      .order('created_at', { ascending: false });

    if (leagueData) {
      setLeagues(leagueData);
      if (!activeLeagueId && leagueData.length > 0) {
        setActiveLeagueId(leagueData[0].id);
      }
    }

    const { data: teamData } = await supabase
      .from('teams')
      .select('*')
      .order('name', { ascending: true });

    if (teamData) setAllTeams(teamData);

    const { data: ltData } = await supabase
      .from('league_teams')
      .select('league_id, team_id');

    if (ltData) setLeagueTeamMap(ltData);

    const { data: matchData } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(name),
        away_team:teams!matches_away_team_id_fkey(name)
      `)
      .order('match_date', { ascending: true });

    if (matchData) setMatches(matchData as unknown as Match[]);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    fetchData();

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginError(error.message);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const activeLeague = leagues.find((lg) => lg.id === activeLeagueId);
  const activeTeamIds = leagueTeamMap
    .filter((lt) => lt.league_id === activeLeagueId)
    .map((lt) => lt.team_id);

  const activeTeams = allTeams.filter((t) => activeTeamIds.includes(t.id));

  const sameSportLeagueIds = leagues
    .filter((lg) => lg.sport === activeLeague?.sport)
    .map((lg) => lg.id);

  const sameSportTeamIds = leagueTeamMap
    .filter((lt) => sameSportLeagueIds.includes(lt.league_id))
    .map((lt) => lt.team_id);

  const availableExistingTeams = allTeams.filter(
    (t) =>
      !activeTeamIds.includes(t.id) &&
      (sameSportTeamIds.includes(t.id) ||
        !leagueTeamMap.some((lt) => lt.team_id === t.id))
  );

  const activeMatches = matches.filter((m) => m.league_id === activeLeagueId);

  useEffect(() => {
    if (activeTeams.length >= 2) {
      setHomeTeamId(activeTeams[0].id);
      setAwayTeamId(activeTeams[1].id);
    } else {
      setHomeTeamId('');
      setAwayTeamId('');
    }
  }, [activeLeagueId, leagueTeamMap, allTeams]);

  // --- Roster Functions ---
  const openRoster = async (team: Team) => {
    setActiveTeamRoster(team);
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('team_id', team.id)
      .order('number', { ascending: true });
    if (data) setPlayers(data);
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTeamRoster || !playerName.trim()) return;

    const { error } = await supabase.from('players').insert([
      {
        team_id: activeTeamRoster.id,
        name: playerName.trim(),
        number: playerNumber ? parseInt(playerNumber) : null,
      },
    ]);

    if (!error) {
      setPlayerName('');
      setPlayerNumber('');
      openRoster(activeTeamRoster);
    } else {
      alert(error.message);
    }
  };

  const handleDeletePlayer = async (id: string) => {
    await supabase.from('players').delete().eq('id', id);
    if (activeTeamRoster) openRoster(activeTeamRoster);
  };

  // --- Box Score Editor Functions ---
  const openBoxScoreEditor = async (match: Match) => {
    setEditingBoxScoreMatch(match);

    const { data: homeP } = await supabase
      .from('players')
      .select('*')
      .eq('team_id', match.home_team_id)
      .order('number', { ascending: true });

    const { data: awayP } = await supabase
      .from('players')
      .select('*')
      .eq('team_id', match.away_team_id)
      .order('number', { ascending: true });

    setMatchPlayersHome(homeP || []);
    setMatchPlayersAway(awayP || []);

    const { data: existingStats } = await supabase
      .from('match_player_stats')
      .select('*')
      .eq('match_id', match.id);

    const statsMap: Record<string, PlayerStat> = {};
    if (existingStats) {
      existingStats.forEach((s) => {
        statsMap[s.player_id] = s;
      });
    }
    setBoxScoreStats(statsMap);
  };

  const handleStatChange = (
    playerId: string,
    teamId: string,
    field: keyof PlayerStat,
    value: number
  ) => {
    setBoxScoreStats((prev) => {
      const current = prev[playerId] || {
        match_id: editingBoxScoreMatch!.id,
        player_id: playerId,
        team_id: teamId,
        points: 0,
        rebounds: 0,
        assists: 0,
        steals: 0,
        blocks: 0,
      };

      return {
        ...prev,
        [playerId]: {
          ...current,
          [field]: Math.max(0, value),
        },
      };
    });
  };

  const handleSaveBoxScore = async () => {
    if (!editingBoxScoreMatch) return;
    setSavingBoxScore(true);

    const statsArray = Object.values(boxScoreStats);

    for (const stat of statsArray) {
      await supabase.from('match_player_stats').upsert(
        {
          match_id: stat.match_id,
          player_id: stat.player_id,
          team_id: stat.team_id,
          points: stat.points || 0,
          rebounds: stat.rebounds || 0,
          assists: stat.assists || 0,
          steals: stat.steals || 0,
          blocks: stat.blocks || 0,
        },
        { onConflict: 'match_id,player_id' }
      );
    }

    setSavingBoxScore(false);
    setEditingBoxScoreMatch(null);
  };

  const handleCreateLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leagueName.trim()) return;

    setCreatingLeague(true);
    const { data, error } = await supabase
      .from('leagues')
      .insert([
        {
          name: leagueName.trim(),
          sport,
          season: season.trim(),
          logo_url: leagueLogoUrl.trim() || null,
        },
      ])
      .select();

    if (error) {
      alert(error.message);
    } else {
      setLeagueName('');
      setLeagueLogoUrl('');
      if (data && data.length > 0) setActiveLeagueId(data[0].id);
      fetchData();
    }
    setCreatingLeague(false);
  };

  const startEditingLeague = (lg: League) => {
    setEditingLeagueId(lg.id);
    setEditingLeagueName(lg.name);
    setEditingLeagueLogoUrl(lg.logo_url || '');
  };

  const handleSaveLeague = async (id: string) => {
    if (!editingLeagueName.trim()) return;
    setSavingLeague(true);

    const { error } = await supabase
      .from('leagues')
      .update({
        name: editingLeagueName.trim(),
        logo_url: editingLeagueLogoUrl.trim() || null,
      })
      .eq('id', id);

    if (error) alert(error.message);
    else {
      setEditingLeagueId(null);
      fetchData();
    }
    setSavingLeague(false);
  };

  const handleAddExistingTeam = async () => {
    if (!activeLeagueId || !selectedExistingTeamId) return;

    const { error } = await supabase.from('league_teams').insert([
      {
        league_id: activeLeagueId,
        team_id: selectedExistingTeamId,
      },
    ]);

    if (error) {
      alert(error.message);
    } else {
      setSelectedExistingTeamId('');
      await fetchData();
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim() || !activeLeagueId) return;

    setCreatingTeam(true);

    const { data: newTeam, error: teamError } = await supabase
      .from('teams')
      .insert([
        {
          name: teamName.trim(),
          logo_url: logoUrl.trim() || null,
          theme_mode: themeMode,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          bg_color: bgColor,
          text_color: textColor,
        },
      ])
      .select()
      .single();

    if (teamError) {
      alert(teamError.message);
    } else if (newTeam) {
      await supabase.from('league_teams').insert([
        {
          league_id: activeLeagueId,
          team_id: newTeam.id,
        },
      ]);

      setTeamName('');
      setLogoUrl('');
      await fetchData();
    }
    setCreatingTeam(false);
  };

  const startEditingTeam = (team: Team) => {
    setEditingTeamId(team.id);
    setEditingTeamName(team.name);
    setEditingLogoUrl(team.logo_url || '');
    setEditingThemeMode(team.theme_mode || 'dark');
    setEditingPrimaryColor(team.primary_color || '#0284c7');
    setEditingSecondaryColor(team.secondary_color || '#0f172a');
    setEditingBgColor(team.bg_color || (team.theme_mode === 'light' ? '#f8fafc' : '#090d16'));
    setEditingTextColor(team.text_color || (team.theme_mode === 'light' ? '#0f172a' : '#ffffff'));
  };

  const handleSaveTeam = async (teamId: string) => {
    if (!editingTeamName.trim()) {
      alert('Team name cannot be empty');
      return;
    }

    setSavingTeam(true);
    const { error } = await supabase
      .from('teams')
      .update({
        name: editingTeamName.trim(),
        logo_url: editingLogoUrl.trim() || null,
        theme_mode: editingThemeMode,
        primary_color: editingPrimaryColor,
        secondary_color: editingSecondaryColor,
        bg_color: editingBgColor,
        text_color: editingTextColor,
      })
      .eq('id', teamId);

    if (error) {
      alert(error.message);
    } else {
      setEditingTeamId(null);
      fetchData();
    }
    setSavingTeam(false);
  };

  const cancelEditingTeam = () => {
    setEditingTeamId(null);
  };

  const handleRemoveTeamFromLeague = async (teamId: string, teamName: string) => {
    if (!confirm(`Remove "${teamName}" from this league?`)) return;

    const { error } = await supabase
      .from('league_teams')
      .delete()
      .eq('league_id', activeLeagueId)
      .eq('team_id', teamId);

    if (error) alert(error.message);
    else fetchData();
  };

  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLeagueId || !homeTeamId || !awayTeamId || !matchDate) {
      alert('Please fill out all match details.');
      return;
    }

    if (homeTeamId === awayTeamId) {
      alert('A team cannot play against itself!');
      return;
    }

    setCreatingMatch(true);
    const { error } = await supabase.from('matches').insert([
      {
        league_id: activeLeagueId,
        round: matchRound.trim() || 'Round 1',
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        match_date: new Date(matchDate).toISOString(),
        status: 'scheduled',
      },
    ]);

    if (error) {
      alert(error.message);
    } else {
      setMatchDate('');
      fetchData();
    }
    setCreatingMatch(false);
  };

  // --- Match Details Edit (Date & Round) ---
  const formatDateForInput = (isoDateString: string) => {
    if (!isoDateString) return '';
    const date = new Date(isoDateString);
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const startEditingMatch = (m: Match) => {
    setEditingMatchId(m.id);
    setEditingMatchRound(m.round || 'Round 1');
    setEditingMatchDate(formatDateForInput(m.match_date));
  };

  const handleSaveMatchDetails = async (matchId: string) => {
    if (!editingMatchDate) {
      alert('Please select a valid date and time.');
      return;
    }

    setSavingMatchDetails(true);
    const { error } = await supabase
      .from('matches')
      .update({
        round: editingMatchRound.trim() || 'Round 1',
        match_date: new Date(editingMatchDate).toISOString(),
      })
      .eq('id', matchId);

    if (error) {
      alert(error.message);
    } else {
      setEditingMatchId(null);
      await fetchData();
    }
    setSavingMatchDetails(false);
  };

  const handleUpdateScore = async (
    matchId: string,
    homeScore: number,
    awayScore: number,
    status: 'scheduled' | 'live' | 'finished',
    round?: string
  ) => {
    const { error } = await supabase
      .from('matches')
      .update({ home_score: homeScore, away_score: awayScore, status, round })
      .eq('id', matchId);

    if (error) alert(error.message);
    else fetchData();
  };

  const handleDeleteLeague = async (id: string, name: string) => {
    if (!confirm(`Delete league "${name}" and all its matches?`)) return;
    const { error } = await supabase.from('leagues').delete().eq('id', id);
    if (error) alert(error.message);
    else {
      if (activeLeagueId === id) setActiveLeagueId(null);
      fetchData();
    }
  };

  const handleDeleteMatch = async (id: string) => {
    if (!confirm('Delete this match?')) return;
    const { error } = await supabase.from('matches').delete().eq('id', id);
    if (error) alert(error.message);
    else fetchData();
  };

  if (!session) {
    return (
      <div
        suppressHydrationWarning
        className="min-h-screen bg-[#090d16] flex items-center justify-center p-4 text-white"
      >
        <form onSubmit={handleLogin} className="bg-gray-900 border border-gray-800 p-8 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
          <h1 className="text-2xl font-bold text-center">Admin Login</h1>
          {loginError && <p className="text-xs text-red-400 bg-red-950/40 p-2 rounded border border-red-800">{loginError}</p>}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2.5 rounded bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2.5 rounded bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none"
              required
            />
          </div>
          <button type="submit" className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 font-bold rounded text-sm transition">
            Sign In
          </button>
        </form>
      </div>
    );
  }

  return (
    <main
      suppressHydrationWarning
      className="max-w-6xl mx-auto p-6 space-y-8 text-white min-h-screen bg-[#090d16]"
    >
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">
          Sports Hub Manager
        </h1>
        <div className="flex items-center gap-3">
          <Link
            href="/matches"
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-lg border border-slate-700 font-medium"
          >
            View Public Matches →
          </Link>
          <button
            onClick={handleLogout}
            className="text-xs bg-red-600/20 hover:bg-red-600/40 text-red-300 px-3 py-2 rounded-lg border border-red-500/30 font-medium"
          >
            🚪 Logout
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* League Form */}
        <form
          onSubmit={handleCreateLeague}
          className="p-5 bg-gray-800 text-white rounded-lg shadow space-y-3"
        >
          <h2 className="text-lg font-semibold">Create New League</h2>
          <input
            type="text"
            placeholder="League Name (e.g. Champions League)"
            value={leagueName}
            onChange={(e) => setLeagueName(e.target.value)}
            className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none text-sm"
            required
          />
          <input
            type="url"
            placeholder="League Logo URL (Optional)"
            value={leagueLogoUrl}
            onChange={(e) => setLeagueLogoUrl(e.target.value)}
            className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              className="p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none text-sm"
            >
              <option value="football">Football</option>
              <option value="basketball">Basketball</option>
            </select>
            <input
              type="text"
              placeholder="Season (e.g. 2025-2026)"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none text-sm"
              required
            />
          </div>
          <button
            type="submit"
            disabled={creatingLeague}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 font-semibold rounded text-sm disabled:opacity-50"
          >
            {creatingLeague ? 'Adding...' : 'Add League'}
          </button>
        </form>

        {/* League Selector Cards */}
        <div className="lg:col-span-2 space-y-2">
          <h2 className="text-lg font-semibold text-white">
            Select a League to Manage:
          </h2>
          {leagues.length === 0 ? (
            <p className="text-gray-400 text-sm">No leagues yet. Create one on the left.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {leagues.map((lg) => {
                const isSelected = lg.id === activeLeagueId;
                const isEditingThis = editingLeagueId === lg.id;

                return (
                  <div
                    key={lg.id}
                    onClick={() => setActiveLeagueId(lg.id)}
                    className={`cursor-pointer p-4 rounded-lg border transition ${
                      isSelected
                        ? 'border-blue-500 bg-blue-950/40 text-white ring-2 ring-blue-500'
                        : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs uppercase px-2 py-0.5 bg-blue-900 text-blue-200 rounded font-bold">
                        {lg.sport}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isEditingThis) setEditingLeagueId(null);
                            else startEditingLeague(lg);
                          }}
                          className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
                        >
                          {isEditingThis ? 'Cancel' : 'Edit'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteLeague(lg.id, lg.name);
                          }}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {isEditingThis ? (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="space-y-2 mt-2 pt-2 border-t border-gray-700"
                      >
                        <input
                          type="text"
                          value={editingLeagueName}
                          onChange={(e) => setEditingLeagueName(e.target.value)}
                          placeholder="League name..."
                          className="w-full p-1.5 rounded bg-gray-800 border border-cyan-500 text-xs text-white"
                        />
                        <input
                          type="url"
                          value={editingLeagueLogoUrl}
                          onChange={(e) => setEditingLeagueLogoUrl(e.target.value)}
                          placeholder="Logo URL..."
                          className="w-full p-1.5 rounded bg-gray-800 border border-cyan-500 text-xs text-white"
                        />
                        <button
                          type="button"
                          disabled={savingLeague}
                          onClick={() => handleSaveLeague(lg.id)}
                          className="w-full py-1 bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold rounded text-white disabled:opacity-50"
                        >
                          {savingLeague ? 'Saving...' : 'Save League'}
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2.5">
                          {lg.logo_url ? (
                            <img
                              src={lg.logo_url}
                              alt={lg.name}
                              className="w-7 h-7 object-contain rounded bg-gray-800 p-0.5 border border-gray-700 shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded bg-gray-800 border border-gray-700 flex items-center justify-center text-xs font-bold text-blue-400 shrink-0">
                              🏆
                            </div>
                          )}
                          <div className="font-bold text-lg truncate">{lg.name}</div>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">{lg.season}</div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {activeLeague ? (
        <section className="p-6 bg-gray-900 border border-gray-700 rounded-xl space-y-8">
          <div className="border-b border-gray-800 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {activeLeague.logo_url ? (
                <img
                  src={activeLeague.logo_url}
                  alt={activeLeague.name}
                  className="w-10 h-10 object-contain rounded-lg bg-gray-800 p-1 border border-gray-700 shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-lg shrink-0">
                  🏆
                </div>
              )}
              <div>
                <span className="text-xs font-bold uppercase text-blue-400">Selected League</span>
                <h2 className="text-2xl font-bold text-white">
                  {activeLeague.name} ({activeLeague.sport.toUpperCase()} - {activeLeague.season})
                </h2>
              </div>
            </div>
            <div className="text-sm text-gray-400">
              {activeTeams.length} Teams | {activeMatches.length} Matches
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Add Team Section */}
            <div className="space-y-4">
              {availableExistingTeams.length > 0 && (
                <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 space-y-2">
                  <h3 className="text-sm font-semibold text-white">
                    Add Existing Team to {activeLeague.name} ({activeLeague.sport})
                  </h3>
                  <div className="flex gap-2">
                    <select
                      value={selectedExistingTeamId}
                      onChange={(e) => setSelectedExistingTeamId(e.target.value)}
                      className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 text-sm focus:outline-none"
                    >
                      <option value="">Select Team...</option>
                      {availableExistingTeams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleAddExistingTeam}
                      disabled={!selectedExistingTeamId}
                      className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 font-bold rounded text-xs text-white disabled:opacity-50 shrink-0"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {/* Create & Join New Team */}
              <form
                onSubmit={handleCreateTeam}
                className="p-4 bg-gray-800 text-white rounded-lg border border-gray-700 space-y-3"
              >
                <h3 className="text-md font-semibold">Create New Team for {activeLeague.name}</h3>
                <input
                  type="text"
                  placeholder="Team Name (e.g. Panathinaikos)"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 text-sm focus:outline-none"
                  required
                />
                <input
                  type="url"
                  placeholder="Logo URL (Optional)"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 text-sm focus:outline-none"
                />

                <div className="space-y-2 pt-1 border-t border-gray-700">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Theme Mode</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setThemeMode('dark');
                          setBgColor('#090d16');
                          setSecondaryColor('#0f172a');
                          setTextColor('#ffffff');
                        }}
                        className={`py-1.5 text-xs rounded font-semibold border ${
                          themeMode === 'dark'
                            ? 'bg-slate-950 text-white border-cyan-500 ring-1 ring-cyan-500'
                            : 'bg-gray-700 text-gray-300 border-gray-600'
                        }`}
                      >
                        🌙 Dark
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setThemeMode('light');
                          setBgColor('#f8fafc');
                          setSecondaryColor('#ffffff');
                          setTextColor('#0f172a');
                        }}
                        className={`py-1.5 text-xs rounded font-semibold border ${
                          themeMode === 'light'
                            ? 'bg-white text-slate-900 border-cyan-500 ring-1 ring-cyan-500'
                            : 'bg-gray-700 text-gray-300 border-gray-600'
                        }`}
                      >
                        ☀️ Light
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Text / Font Color</label>
                      <div className="flex items-center gap-2 bg-gray-700 p-1.5 rounded border border-gray-600">
                        <input
                          type="color"
                          value={textColor}
                          onChange={(e) => setTextColor(e.target.value)}
                          className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                        />
                        <span className="text-xs font-mono">{textColor}</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Page Background</label>
                      <div className="flex items-center gap-2 bg-gray-700 p-1.5 rounded border border-gray-600">
                        <input
                          type="color"
                          value={bgColor}
                          onChange={(e) => setBgColor(e.target.value)}
                          className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                        />
                        <span className="text-xs font-mono">{bgColor}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Primary (Accents)</label>
                      <div className="flex items-center gap-2 bg-gray-700 p-1.5 rounded border border-gray-600">
                        <input
                          type="color"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                        />
                        <span className="text-xs font-mono">{primaryColor}</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Card / Banner Color</label>
                      <div className="flex items-center gap-2 bg-gray-700 p-1.5 rounded border border-gray-600">
                        <input
                          type="color"
                          value={secondaryColor}
                          onChange={(e) => setSecondaryColor(e.target.value)}
                          className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                        />
                        <span className="text-xs font-mono">{secondaryColor}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={creatingTeam}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 font-semibold rounded text-sm disabled:opacity-50"
                >
                  {creatingTeam ? 'Adding Team...' : 'Create & Add Team'}
                </button>
              </form>

              {/* Teams List */}
              <div className="p-4 bg-gray-800 text-white rounded-lg border border-gray-700 space-y-2">
                <h4 className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-2">
                  League Teams ({activeTeams.length})
                </h4>
                {activeTeams.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No teams in this league yet.</p>
                ) : (
                  <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                    {activeTeams.map((team) => {
                      const isEditing = editingTeamId === team.id;

                      return (
                        <div
                          key={team.id}
                          className="p-2.5 bg-gray-700/60 rounded-lg border border-gray-600/50 space-y-2 text-sm"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5 overflow-hidden">
                              {team.logo_url ? (
                                <img
                                  src={team.logo_url}
                                  alt=""
                                  className="w-6 h-6 object-contain rounded bg-gray-800 p-0.5 shrink-0"
                                />
                              ) : (
                                <div
                                  style={{ backgroundColor: team.primary_color || '#0284c7' }}
                                  className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white shrink-0"
                                >
                                  {team.name.charAt(0)}
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 truncate">
                                <Link
                                  href={`/teams/${team.id}`}
                                  className="font-medium truncate hover:text-cyan-400 hover:underline"
                                >
                                  {team.name}
                                </Link>
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/40"
                                  style={{ backgroundColor: team.primary_color || '#0284c7' }}
                                  title={`Accent: ${team.primary_color}`}
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => openRoster(team)}
                                className="text-xs text-emerald-400 hover:text-emerald-300 font-bold"
                              >
                                👥 Roster
                              </button>
                              <button
                                onClick={() =>
                                  isEditing ? cancelEditingTeam() : startEditingTeam(team)
                                }
                                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
                              >
                                {isEditing ? 'Cancel' : 'Edit'}
                              </button>
                              <button
                                onClick={() => handleRemoveTeamFromLeague(team.id, team.name)}
                                className="text-gray-400 hover:text-red-400 text-xs px-1"
                                title="Remove from league"
                              >
                                ✕
                              </button>
                            </div>
                          </div>

                          {isEditing && (
                            <div className="pt-2 border-t border-gray-600/70 space-y-2">
                              <div>
                                <label className="block text-[11px] text-gray-400 mb-1">
                                  Team Name
                                </label>
                                <input
                                  type="text"
                                  value={editingTeamName}
                                  onChange={(e) => setEditingTeamName(e.target.value)}
                                  className="w-full p-1.5 rounded bg-gray-800 border border-cyan-500 text-xs text-white focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] text-gray-400 mb-1">
                                  Logo URL
                                </label>
                                <input
                                  type="url"
                                  value={editingLogoUrl}
                                  onChange={(e) => setEditingLogoUrl(e.target.value)}
                                  className="w-full p-1.5 rounded bg-gray-800 border border-cyan-500 text-xs text-white focus:outline-none"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-2 pt-1">
                                <div>
                                  <label className="block text-[11px] text-gray-400 mb-1">Theme</label>
                                  <select
                                    value={editingThemeMode}
                                    onChange={(e) =>
                                      setEditingThemeMode(e.target.value as 'dark' | 'light')
                                    }
                                    className="w-full p-1 rounded bg-gray-800 border border-gray-600 text-xs text-white"
                                  >
                                    <option value="dark">🌙 Dark</option>
                                    <option value="light">☀️ Light</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[11px] text-gray-400 mb-1">
                                    Text / Font Color
                                  </label>
                                  <input
                                    type="color"
                                    value={editingTextColor}
                                    onChange={(e) => setEditingTextColor(e.target.value)}
                                    className="w-full h-7 rounded cursor-pointer bg-transparent border-0"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[11px] text-gray-400 mb-1">
                                    Primary Color
                                  </label>
                                  <input
                                    type="color"
                                    value={editingPrimaryColor}
                                    onChange={(e) => setEditingPrimaryColor(e.target.value)}
                                    className="w-full h-7 rounded cursor-pointer bg-transparent border-0"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] text-gray-400 mb-1">
                                    Page Background
                                  </label>
                                  <input
                                    type="color"
                                    value={editingBgColor}
                                    onChange={(e) => setEditingBgColor(e.target.value)}
                                    className="w-full h-7 rounded cursor-pointer bg-transparent border-0"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-[11px] text-gray-400 mb-1">
                                  Card / Banner Color
                                </label>
                                <input
                                  type="color"
                                  value={editingSecondaryColor}
                                  onChange={(e) => setEditingSecondaryColor(e.target.value)}
                                  className="w-full h-7 rounded cursor-pointer bg-transparent border-0"
                                />
                              </div>

                              <div className="flex justify-end gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={cancelEditingTeam}
                                  className="text-xs px-2 py-1 rounded bg-gray-600 hover:bg-gray-500 text-gray-200"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={savingTeam}
                                  onClick={() => handleSaveTeam(team.id)}
                                  className="text-xs px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 font-semibold text-white disabled:opacity-50"
                                >
                                  {savingTeam ? 'Saving...' : 'Save Changes'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Roster Modal / Panel */}
              {activeTeamRoster && (
                <div className="p-4 bg-slate-900 rounded-lg border border-cyan-500/50 space-y-3 shadow-lg">
                  <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                    <h3 className="text-sm font-bold text-cyan-400">
                      🏀 {activeTeamRoster.name} Roster
                    </h3>
                    <button
                      onClick={() => setActiveTeamRoster(null)}
                      className="text-xs text-gray-400 hover:text-white"
                    >
                      ✕ Close
                    </button>
                  </div>

                  <form onSubmit={handleAddPlayer} className="grid grid-cols-4 gap-1.5">
                    <input
                      type="text"
                      placeholder="Player Name"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      className="col-span-2 p-1.5 rounded bg-gray-800 text-xs border border-gray-700 text-white"
                      required
                    />
                    <input
                      type="number"
                      placeholder="#"
                      value={playerNumber}
                      onChange={(e) => setPlayerNumber(e.target.value)}
                      className="p-1.5 rounded bg-gray-800 text-xs border border-gray-700 text-white"
                    />
                    <button
                      type="submit"
                      className="bg-cyan-600 hover:bg-cyan-500 text-xs font-bold rounded p-1.5 text-white"
                    >
                      + Add
                    </button>
                  </form>

                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {players.length === 0 ? (
                      <p className="text-xs text-gray-500 italic text-center py-2">
                        No players added yet.
                      </p>
                    ) : (
                      players.map((p) => (
                        <div
                          key={p.id}
                          className="flex justify-between items-center text-xs p-1.5 bg-gray-800 rounded text-gray-200"
                        >
                          <span>
                            #{p.number || '-'} {p.name}
                          </span>
                          <button
                            onClick={() => handleDeletePlayer(p.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            ✕
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Schedule Match Form with Round input & Matches List */}
            <div className="lg:col-span-2 space-y-6">
              <form
                onSubmit={handleCreateMatch}
                className="p-4 bg-gray-800 text-white rounded-lg border border-gray-700 space-y-3"
              >
                <h3 className="text-md font-semibold">Schedule Match in {activeLeague.name}</h3>
                {activeTeams.length < 2 ? (
                  <p className="text-xs text-amber-400 bg-amber-950/40 p-2 rounded border border-amber-800">
                    Add at least 2 teams to this league to schedule a match.
                  </p>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        Round / Stage (e.g. Round 1, Round of 16, Quarter-finals, Final)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={matchRound}
                          onChange={(e) => setMatchRound(e.target.value)}
                          placeholder="e.g. Round 1"
                          list="round-presets"
                          className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 text-sm focus:outline-none"
                          required
                        />
                        <datalist id="round-presets">
                          <option value="Round 1" />
                          <option value="Round 2" />
                          <option value="Round 3" />
                          <option value="Round 4" />
                          <option value="Round 5" />
                          <option value="Round of 16" />
                          <option value="Quarter-finals" />
                          <option value="Semi-finals" />
                          <option value="Final" />
                        </datalist>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Home Team</label>
                        <select
                          value={homeTeamId}
                          onChange={(e) => setHomeTeamId(e.target.value)}
                          className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 text-sm focus:outline-none"
                          required
                        >
                          {activeTeams.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Away Team</label>
                        <select
                          value={awayTeamId}
                          onChange={(e) => setAwayTeamId(e.target.value)}
                          className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 text-sm focus:outline-none"
                          required
                        >
                          {activeTeams.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Match Date & Time</label>
                      <input
                        type="datetime-local"
                        value={matchDate}
                        onChange={(e) => setMatchDate(e.target.value)}
                        className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 text-sm focus:outline-none"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={creatingMatch}
                      className="w-full py-2 bg-purple-600 hover:bg-purple-700 font-semibold rounded text-sm disabled:opacity-50"
                    >
                      {creatingMatch ? 'Scheduling...' : 'Schedule Match'}
                    </button>
                  </>
                )}
              </form>

              {/* Matches List */}
              <div className="space-y-3">
                <h3 className="text-md font-semibold text-white">
                  Matches ({activeMatches.length})
                </h3>
                {activeMatches.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">
                    No matches scheduled in this league yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {activeMatches.map((m) => {
                      const isEditingMatch = editingMatchId === m.id;

                      return (
                        <div
                          key={m.id}
                          className="p-3 bg-gray-800 border border-gray-700 rounded-lg text-white space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="flex flex-col text-xs text-gray-400">
                              <span className="font-semibold text-cyan-400">
                                {m.round || 'Round 1'}
                              </span>
                              <span>{new Date(m.match_date).toLocaleString('en-US')}</span>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-sm w-28 text-right truncate">
                                {m.home_team?.name || 'Home'}
                              </span>
                              <input
                                type="number"
                                min="0"
                                value={m.home_score}
                                onChange={(e) =>
                                  handleUpdateScore(
                                    m.id,
                                    parseInt(e.target.value) || 0,
                                    m.away_score,
                                    m.status,
                                    m.round
                                  )
                                }
                                className="w-12 text-center p-1 bg-gray-700 border border-gray-600 rounded text-sm font-bold"
                              />
                              <span className="text-gray-400 font-bold">-</span>
                              <input
                                type="number"
                                min="0"
                                value={m.away_score}
                                onChange={(e) =>
                                  handleUpdateScore(
                                    m.id,
                                    m.home_score,
                                    parseInt(e.target.value) || 0,
                                    m.status,
                                    m.round
                                  )
                                }
                                className="w-12 text-center p-1 bg-gray-700 border border-gray-600 rounded text-sm font-bold"
                              />
                              <span className="font-semibold text-sm w-28 truncate">
                                {m.away_team?.name || 'Away'}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {activeLeague.sport.toLowerCase() === 'basketball' && (
                                <button
                                  onClick={() => openBoxScoreEditor(m)}
                                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 font-bold rounded text-xs text-white shrink-0"
                                >
                                  📝 Box Score
                                </button>
                              )}

                              <button
                                onClick={() =>
                                  isEditingMatch ? setEditingMatchId(null) : startEditingMatch(m)
                                }
                                className="px-2 py-1 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-500/30 rounded text-xs font-medium shrink-0"
                              >
                                {isEditingMatch ? 'Cancel' : '✏️ Edit'}
                              </button>

                              <select
                                value={m.status}
                                onChange={(e) =>
                                  handleUpdateScore(
                                    m.id,
                                    m.home_score,
                                    m.away_score,
                                    e.target.value as Match['status'],
                                    m.round
                                  )
                                }
                                className="text-xs p-1 bg-gray-700 border border-gray-600 rounded text-gray-200"
                              >
                                <option value="scheduled">Scheduled</option>
                                <option value="live">Live</option>
                                <option value="finished">Finished</option>
                              </select>
                              <button
                                onClick={() => handleDeleteMatch(m.id)}
                                className="text-xs text-red-400 hover:text-red-300"
                              >
                                ✕
                              </button>
                            </div>
                          </div>

                          {/* Inline Edit Form for Round & Date */}
                          {isEditingMatch && (
                            <div className="pt-2.5 border-t border-gray-700 flex flex-wrap items-end justify-between gap-3 bg-gray-900/60 p-2.5 rounded-lg">
                              <div className="flex-1 min-w-[140px]">
                                <label className="block text-[11px] text-gray-400 mb-1">
                                  Round / Stage
                                </label>
                                <input
                                  type="text"
                                  value={editingMatchRound}
                                  onChange={(e) => setEditingMatchRound(e.target.value)}
                                  list="round-presets"
                                  className="w-full p-1.5 rounded bg-gray-800 border border-cyan-500 text-xs text-white focus:outline-none"
                                />
                              </div>

                              <div className="flex-1 min-w-[180px]">
                                <label className="block text-[11px] text-gray-400 mb-1">
                                  Date & Time
                                </label>
                                <input
                                  type="datetime-local"
                                  value={editingMatchDate}
                                  onChange={(e) => setEditingMatchDate(e.target.value)}
                                  className="w-full p-1.5 rounded bg-gray-800 border border-cyan-500 text-xs text-white focus:outline-none"
                                />
                              </div>

                              <button
                                type="button"
                                disabled={savingMatchDetails}
                                onClick={() => handleSaveMatchDetails(m.id)}
                                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-xs font-bold rounded text-white disabled:opacity-50 shrink-0"
                              >
                                {savingMatchDetails ? 'Saving...' : 'Save Changes'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <div className="p-8 text-center text-gray-400 bg-gray-900 border border-gray-800 rounded-lg">
          Please create or select a league to manage its teams and matches.
        </div>
      )}

      {/* Box Score Editor Modal */}
      {editingBoxScoreMatch && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto space-y-6 text-white shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-xl font-bold text-amber-400">
                🏀 Edit Box Score: {editingBoxScoreMatch.home_team?.name} vs{' '}
                {editingBoxScoreMatch.away_team?.name}
              </h2>
              <button
                onClick={() => setEditingBoxScoreMatch(null)}
                className="text-sm text-gray-400 hover:text-white"
              >
                ✕ Close
              </button>
            </div>

            {/* Home & Away Stats Tables */}
            {[
              {
                teamName: editingBoxScoreMatch.home_team?.name,
                teamId: editingBoxScoreMatch.home_team_id,
                playersList: matchPlayersHome,
              },
              {
                teamName: editingBoxScoreMatch.away_team?.name,
                teamId: editingBoxScoreMatch.away_team_id,
                playersList: matchPlayersAway,
              },
            ].map((section, idx) => (
              <div key={idx} className="space-y-2">
                <h3 className="text-sm font-bold text-slate-300">{section.teamName} Player Stats</h3>
                {section.playersList.length === 0 ? (
                  <div className="text-xs text-amber-400/80 bg-amber-950/20 p-2 rounded border border-amber-900/30">
                    No players in roster. Click "👥 Roster" next to the team to add players first!
                  </div>
                ) : (
                  <table className="w-full text-left text-xs bg-slate-950 border border-slate-800 rounded-lg">
                    <thead className="bg-slate-800 text-slate-400">
                      <tr>
                        <th className="p-2">Player</th>
                        <th className="p-2 text-center">PTS</th>
                        <th className="p-2 text-center">REB</th>
                        <th className="p-2 text-center">AST</th>
                        <th className="p-2 text-center">STL</th>
                        <th className="p-2 text-center">BLK</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {section.playersList.map((p) => {
                        const stat = boxScoreStats[p.id] || {
                          points: 0,
                          rebounds: 0,
                          assists: 0,
                          steals: 0,
                          blocks: 0,
                        };
                        return (
                          <tr key={p.id}>
                            <td className="p-2 font-bold">
                              #{p.number || '-'} {p.name}
                            </td>
                            {['points', 'rebounds', 'assists', 'steals', 'blocks'].map((field) => (
                              <td key={field} className="p-2 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  value={stat[field as keyof PlayerStat] as number}
                                  onChange={(e) =>
                                    handleStatChange(
                                      p.id,
                                      section.teamId,
                                      field as keyof PlayerStat,
                                      parseInt(e.target.value) || 0
                                    )
                                  }
                                  className="w-12 text-center bg-slate-800 p-1 rounded font-mono font-bold text-white border border-slate-700"
                                />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            ))}

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setEditingBoxScoreMatch(null)}
                className="px-4 py-2 rounded bg-gray-700 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBoxScore}
                disabled={savingBoxScore}
                className="px-5 py-2 rounded bg-amber-600 hover:bg-amber-500 text-xs font-bold"
              >
                {savingBoxScore ? 'Saving...' : 'Save Box Score'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default dynamic(() => Promise.resolve(HomeContent), {
  ssr: false,
});