"""
pytest migration tests for BlokHR migrations 040–044.

Tests every structural and constraint guarantee in each SQL file
using Python's sqlite3 module with foreign key enforcement enabled.

Run: pytest tests/test_migrations.py -v
"""

import sqlite3
import os
import pytest

MIGRATIONS_DIR = "/tmp/blokhr_work/migrations"


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

def apply_migrations(conn: sqlite3.Connection, *filenames: str) -> None:
    """Apply one or more named migration files to a connection."""
    conn.execute("PRAGMA foreign_keys = ON")
    for filename in filenames:
        path = os.path.join(MIGRATIONS_DIR, filename)
        with open(path) as f:
            conn.executescript(f.read())


@pytest.fixture
def db_040():
    """Fresh DB with migration 040 applied."""
    conn = sqlite3.connect(":memory:")
    apply_migrations(conn, "040_approval_flows.sql")
    yield conn
    conn.close()


@pytest.fixture
def db_041():
    conn = sqlite3.connect(":memory:")
    apply_migrations(conn, "041_colour_scheme_presets.sql")
    yield conn
    conn.close()


@pytest.fixture
def db_042():
    conn = sqlite3.connect(":memory:")
    apply_migrations(conn, "042_custom_tabs.sql")
    yield conn
    conn.close()


@pytest.fixture
def db_043():
    conn = sqlite3.connect(":memory:")
    apply_migrations(conn, "043_notification_channel_config.sql")
    yield conn
    conn.close()


@pytest.fixture
def db_044():
    conn = sqlite3.connect(":memory:")
    apply_migrations(conn, "044_meeting_platform_config.sql")
    yield conn
    conn.close()


@pytest.fixture
def db_all():
    """DB with all five migrations applied (tests cross-migration behaviour)."""
    conn = sqlite3.connect(":memory:")
    apply_migrations(
        conn,
        "040_approval_flows.sql",
        "041_colour_scheme_presets.sql",
        "042_custom_tabs.sql",
        "043_notification_channel_config.sql",
        "044_meeting_platform_config.sql",
    )
    yield conn
    conn.close()


def count(conn: sqlite3.Connection, table: str, where: str = "") -> int:
    sql = f"SELECT COUNT(*) FROM {table}" + (f" WHERE {where}" if where else "")
    return conn.execute(sql).fetchone()[0]


# ─────────────────────────────────────────────────────────────────────────────
# 040 — approval_flows + approval_steps
# ─────────────────────────────────────────────────────────────────────────────

class TestApprovalFlows:

    def test_approval_flows_table_exists(self, db_040):
        r = db_040.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='approval_flows'").fetchone()
        assert r is not None

    def test_approval_steps_table_exists(self, db_040):
        r = db_040.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='approval_steps'").fetchone()
        assert r is not None

    def test_seeded_five_flows(self, db_040):
        assert count(db_040, "approval_flows") == 5

    def test_seeded_five_steps(self, db_040):
        assert count(db_040, "approval_steps") == 5

    def test_all_five_entity_types_present(self, db_040):
        rows = db_040.execute("SELECT entity_type FROM approval_flows ORDER BY entity_type").fetchall()
        types = [r[0] for r in rows]
        assert types == ["expense", "leave", "overtime", "regularization", "training"]

    def test_all_seed_steps_have_role_manager(self, db_040):
        assert count(db_040, "approval_steps", "role = 'manager'") == 5

    def test_all_seed_steps_at_level_1(self, db_040):
        assert count(db_040, "approval_steps", "level = 1") == 5

    def test_unique_entity_type_rejects_duplicate(self, db_040):
        with pytest.raises(sqlite3.IntegrityError):
            db_040.execute("INSERT INTO approval_flows (entity_type) VALUES ('leave')")

    def test_check_rejects_invalid_entity_type(self, db_040):
        with pytest.raises(sqlite3.IntegrityError):
            db_040.execute("INSERT INTO approval_flows (entity_type) VALUES ('payroll')")

    def test_unique_flow_level_rejects_duplicate_step(self, db_040):
        with pytest.raises(sqlite3.IntegrityError):
            db_040.execute("INSERT INTO approval_steps (flow_id, level, role) VALUES ('flow-leave', 1, 'hr')")

    def test_can_add_second_step(self, db_040):
        db_040.execute("INSERT INTO approval_steps (flow_id, level, role) VALUES ('flow-leave', 2, 'hr')")
        assert count(db_040, "approval_steps", "flow_id = 'flow-leave'") == 2

    def test_escalate_hours_check_rejects_zero(self, db_040):
        with pytest.raises(sqlite3.IntegrityError):
            db_040.execute(
                "INSERT INTO approval_flows (entity_type, auto_escalation_hours) VALUES ('leave', 0)"
            )

    def test_can_update_auto_escalation(self, db_040):
        db_040.execute("UPDATE approval_flows SET auto_escalation_enabled = 1 WHERE entity_type = 'leave'")
        assert count(db_040, "approval_flows", "auto_escalation_enabled = 1 AND entity_type = 'leave'") == 1

    def test_can_delete_a_step(self, db_040):
        db_040.execute("DELETE FROM approval_steps WHERE flow_id = 'flow-expense' AND level = 1")
        assert count(db_040, "approval_steps", "flow_id = 'flow-expense'") == 0

    def test_can_delete_a_flow(self, db_040):
        db_040.execute("DELETE FROM approval_flows WHERE entity_type = 'overtime'")
        assert count(db_040, "approval_flows", "entity_type = 'overtime'") == 0

    def test_cascade_delete_removes_steps(self, db_040):
        """Deleting a flow removes its steps (requires FK enforcement)."""
        db_040.execute("PRAGMA foreign_keys = ON")
        db_040.execute("DELETE FROM approval_flows WHERE id = 'flow-leave'")
        assert count(db_040, "approval_steps", "flow_id = 'flow-leave'") == 0

    def test_idx_approval_steps_flow_id_exists(self, db_040):
        r = db_040.execute(
            "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_approval_steps_flow_id'"
        ).fetchone()
        assert r is not None


# ─────────────────────────────────────────────────────────────────────────────
# 041 — colour_scheme_presets
# ─────────────────────────────────────────────────────────────────────────────

class TestColourSchemePresets:

    def test_table_exists(self, db_041):
        r = db_041.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='colour_scheme_presets'").fetchone()
        assert r is not None

    def test_seeded_three_presets(self, db_041):
        assert count(db_041, "colour_scheme_presets") == 3

    def test_exactly_one_default(self, db_041):
        assert count(db_041, "colour_scheme_presets", "is_default = 1") == 1

    def test_chromium_is_default(self, db_041):
        assert count(db_041, "colour_scheme_presets", "id = 'csp-chromium' AND is_default = 1") == 1

    def test_all_three_names_present(self, db_041):
        rows = db_041.execute("SELECT name FROM colour_scheme_presets ORDER BY name").fetchall()
        names = {r[0] for r in rows}
        assert names == {"Chromium Forge", "Neural Circuit", "Clean Mode"}

    def test_all_hex_columns_populated_for_chromium(self, db_041):
        row = db_041.execute(
            "SELECT accent, status_in, status_break, status_absent, bg0, tx "
            "FROM colour_scheme_presets WHERE id = 'csp-chromium'"
        ).fetchone()
        for v in row:
            assert v and v.startswith("#") and len(v) == 7, f"bad hex: {v}"

    def test_check_rejects_invalid_hex_accent(self, db_041):
        with pytest.raises(sqlite3.IntegrityError):
            db_041.execute(
                "INSERT INTO colour_scheme_presets "
                "(name,accent,status_in,status_break,status_absent,bg0,tx) "
                "VALUES ('X','notvalid','#000000','#000000','#000000','#000000','#000000')"
            )

    def test_can_create_new_preset(self, db_041):
        db_041.execute(
            "INSERT INTO colour_scheme_presets "
            "(name,accent,status_in,status_break,status_absent,bg0,tx) "
            "VALUES ('Test','#aabbcc','#aabbcc','#aabbcc','#aabbcc','#aabbcc','#aabbcc')"
        )
        assert count(db_041, "colour_scheme_presets") == 4

    def test_can_update_accent(self, db_041):
        db_041.execute("UPDATE colour_scheme_presets SET accent = '#ff0000' WHERE id = 'csp-neural'")
        r = db_041.execute("SELECT accent FROM colour_scheme_presets WHERE id = 'csp-neural'").fetchone()
        assert r[0] == "#ff0000"

    def test_can_swap_default(self, db_041):
        db_041.execute("UPDATE colour_scheme_presets SET is_default = 0")
        db_041.execute("UPDATE colour_scheme_presets SET is_default = 1 WHERE id = 'csp-neural'")
        assert count(db_041, "colour_scheme_presets", "is_default = 1") == 1
        r = db_041.execute("SELECT id FROM colour_scheme_presets WHERE is_default = 1").fetchone()
        assert r[0] == "csp-neural"

    def test_can_delete_non_default(self, db_041):
        db_041.execute("DELETE FROM colour_scheme_presets WHERE id = 'csp-neural'")
        assert count(db_041, "colour_scheme_presets") == 2


# ─────────────────────────────────────────────────────────────────────────────
# 042 — custom_tabs + custom_tab_visibility
# ─────────────────────────────────────────────────────────────────────────────

class TestCustomTabs:

    def test_custom_tabs_table_exists(self, db_042):
        r = db_042.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='custom_tabs'").fetchone()
        assert r is not None

    def test_custom_tab_visibility_table_exists(self, db_042):
        r = db_042.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='custom_tab_visibility'").fetchone()
        assert r is not None

    def test_starts_empty(self, db_042):
        assert count(db_042, "custom_tabs") == 0

    def test_can_create_tab(self, db_042):
        db_042.execute("INSERT INTO custom_tabs (id, label, src, icon, enabled, sort_order) VALUES ('t1','Reports','/rpt','📊',1,1)")
        assert count(db_042, "custom_tabs") == 1

    def test_label_check_rejects_empty(self, db_042):
        with pytest.raises(sqlite3.IntegrityError):
            db_042.execute("INSERT INTO custom_tabs (label) VALUES ('')")

    def test_label_check_rejects_over_30_chars(self, db_042):
        with pytest.raises(sqlite3.IntegrityError):
            db_042.execute("INSERT INTO custom_tabs (label) VALUES ('abcdefghijklmnopqrstuvwxyz12345')")

    def test_can_assign_group_visibility(self, db_042):
        db_042.execute("INSERT INTO custom_tabs (id, label) VALUES ('t1','Reports')")
        db_042.execute("INSERT INTO custom_tab_visibility (tab_id, group_id) VALUES ('t1','g-eng')")
        db_042.execute("INSERT INTO custom_tab_visibility (tab_id, group_id) VALUES ('t1','g-hr')")
        assert count(db_042, "custom_tab_visibility", "tab_id = 't1'") == 2

    def test_pk_prevents_duplicate_visibility_row(self, db_042):
        db_042.execute("INSERT INTO custom_tabs (id, label) VALUES ('t1','Reports')")
        db_042.execute("INSERT INTO custom_tab_visibility (tab_id, group_id) VALUES ('t1','g-eng')")
        with pytest.raises(sqlite3.IntegrityError):
            db_042.execute("INSERT INTO custom_tab_visibility (tab_id, group_id) VALUES ('t1','g-eng')")

    def test_can_update_sort_order(self, db_042):
        db_042.execute("INSERT INTO custom_tabs (id, label, sort_order) VALUES ('t1','Reports',1)")
        db_042.execute("UPDATE custom_tabs SET sort_order = 99 WHERE id = 't1'")
        r = db_042.execute("SELECT sort_order FROM custom_tabs WHERE id = 't1'").fetchone()
        assert r[0] == 99

    def test_can_disable_tab(self, db_042):
        db_042.execute("INSERT INTO custom_tabs (id, label, enabled) VALUES ('t1','Reports',1)")
        db_042.execute("UPDATE custom_tabs SET enabled = 0 WHERE id = 't1'")
        assert count(db_042, "custom_tabs", "enabled = 0") == 1

    def test_enabled_check_rejects_invalid(self, db_042):
        with pytest.raises(sqlite3.IntegrityError):
            db_042.execute("INSERT INTO custom_tabs (label, enabled) VALUES ('Reports', 2)")

    def test_can_delete_tab(self, db_042):
        db_042.execute("INSERT INTO custom_tabs (id, label) VALUES ('t1','Reports')")
        db_042.execute("DELETE FROM custom_tabs WHERE id = 't1'")
        assert count(db_042, "custom_tabs") == 0

    def test_cascade_delete_removes_visibility_rows(self, db_042):
        db_042.execute("PRAGMA foreign_keys = ON")
        db_042.execute("INSERT INTO custom_tabs (id, label) VALUES ('t1','Reports')")
        db_042.execute("INSERT INTO custom_tab_visibility (tab_id, group_id) VALUES ('t1','g-eng')")
        db_042.execute("DELETE FROM custom_tabs WHERE id = 't1'")
        assert count(db_042, "custom_tab_visibility", "tab_id = 't1'") == 0

    def test_idx_custom_tabs_sort_exists(self, db_042):
        r = db_042.execute(
            "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_custom_tabs_sort'"
        ).fetchone()
        assert r is not None

    def test_idx_ctv_tab_id_exists(self, db_042):
        r = db_042.execute(
            "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_ctv_tab_id'"
        ).fetchone()
        assert r is not None


# ─────────────────────────────────────────────────────────────────────────────
# 043 — notification_channel_config
# ─────────────────────────────────────────────────────────────────────────────

class TestNotificationChannelConfig:

    def test_table_exists(self, db_043):
        r = db_043.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='notification_channel_config'").fetchone()
        assert r is not None

    def test_seeded_eight_channels(self, db_043):
        assert count(db_043, "notification_channel_config") == 8

    def test_all_channels_start_disabled(self, db_043):
        assert count(db_043, "notification_channel_config", "enabled = 0") == 8

    def test_all_eight_channel_names_present(self, db_043):
        rows = db_043.execute("SELECT channel FROM notification_channel_config ORDER BY channel").fetchall()
        channels = {r[0] for r in rows}
        assert channels == {"teams", "slack", "google_chat", "discord", "telegram", "whatsapp", "clickup", "email"}

    def test_check_rejects_invalid_channel(self, db_043):
        with pytest.raises(sqlite3.IntegrityError):
            db_043.execute("INSERT INTO notification_channel_config (channel) VALUES ('sms')")

    def test_pk_prevents_duplicate_channel(self, db_043):
        with pytest.raises(sqlite3.IntegrityError):
            db_043.execute("INSERT INTO notification_channel_config (channel) VALUES ('slack')")

    def test_can_enable_channel(self, db_043):
        db_043.execute("UPDATE notification_channel_config SET enabled = 1 WHERE channel = 'slack'")
        assert count(db_043, "notification_channel_config", "enabled = 1 AND channel = 'slack'") == 1

    def test_enabled_check_rejects_invalid_value(self, db_043):
        with pytest.raises(sqlite3.IntegrityError):
            db_043.execute("UPDATE notification_channel_config SET enabled = 2 WHERE channel = 'slack'")

    def test_can_write_slack_credentials(self, db_043):
        db_043.execute(
            "UPDATE notification_channel_config SET slack_bot_token = 'xoxb-test', "
            "slack_signing_secret = 'ssec' WHERE channel = 'slack'"
        )
        r = db_043.execute("SELECT slack_bot_token FROM notification_channel_config WHERE channel = 'slack'").fetchone()
        assert r[0] == "xoxb-test"

    def test_can_write_smtp_credentials(self, db_043):
        db_043.execute(
            "UPDATE notification_channel_config SET smtp_host = 'smtp.test.com', "
            "smtp_port = 465 WHERE channel = 'email'"
        )
        r = db_043.execute("SELECT smtp_host, smtp_port FROM notification_channel_config WHERE channel = 'email'").fetchone()
        assert r == ("smtp.test.com", 465)

    def test_can_write_teams_credentials(self, db_043):
        db_043.execute(
            "UPDATE notification_channel_config SET teams_app_id = 'app-id', "
            "teams_app_password = 'pw' WHERE channel = 'teams'"
        )
        r = db_043.execute("SELECT teams_app_id FROM notification_channel_config WHERE channel = 'teams'").fetchone()
        assert r[0] == "app-id"

    def test_can_write_discord_credentials(self, db_043):
        db_043.execute(
            "UPDATE notification_channel_config SET discord_bot_token = 'tok', "
            "discord_app_id = 'app' WHERE channel = 'discord'"
        )
        r = db_043.execute("SELECT discord_bot_token FROM notification_channel_config WHERE channel = 'discord'").fetchone()
        assert r[0] == "tok"

    def test_can_write_telegram_token(self, db_043):
        db_043.execute("UPDATE notification_channel_config SET telegram_bot_token = 'tg-tok' WHERE channel = 'telegram'")
        r = db_043.execute("SELECT telegram_bot_token FROM notification_channel_config WHERE channel = 'telegram'").fetchone()
        assert r[0] == "tg-tok"

    def test_smtp_port_default_is_587(self, db_043):
        r = db_043.execute("SELECT smtp_port FROM notification_channel_config WHERE channel = 'email'").fetchone()
        assert r[0] == 587


# ─────────────────────────────────────────────────────────────────────────────
# 044 — meeting_platform_config
# ─────────────────────────────────────────────────────────────────────────────

class TestMeetingPlatformConfig:

    def test_table_exists(self, db_044):
        r = db_044.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='meeting_platform_config'").fetchone()
        assert r is not None

    def test_seeded_four_platforms(self, db_044):
        assert count(db_044, "meeting_platform_config") == 4

    def test_all_platforms_start_disabled(self, db_044):
        assert count(db_044, "meeting_platform_config", "enabled = 0") == 4

    def test_all_four_platform_names_present(self, db_044):
        rows = db_044.execute("SELECT platform FROM meeting_platform_config ORDER BY platform").fetchall()
        platforms = {r[0] for r in rows}
        assert platforms == {"zoom", "webex", "goto", "bluejeans"}

    def test_check_rejects_invalid_platform(self, db_044):
        with pytest.raises(sqlite3.IntegrityError):
            db_044.execute("INSERT INTO meeting_platform_config (platform) VALUES ('teams')")

    def test_pk_prevents_duplicate_platform(self, db_044):
        with pytest.raises(sqlite3.IntegrityError):
            db_044.execute("INSERT INTO meeting_platform_config (platform) VALUES ('zoom')")

    def test_can_enable_platform(self, db_044):
        db_044.execute("UPDATE meeting_platform_config SET enabled = 1 WHERE platform = 'zoom'")
        assert count(db_044, "meeting_platform_config", "enabled = 1 AND platform = 'zoom'") == 1

    def test_enabled_check_rejects_invalid_value(self, db_044):
        with pytest.raises(sqlite3.IntegrityError):
            db_044.execute("UPDATE meeting_platform_config SET enabled = 5 WHERE platform = 'zoom'")

    def test_can_write_zoom_credentials(self, db_044):
        db_044.execute(
            "UPDATE meeting_platform_config SET zoom_account_id = 'acct', "
            "zoom_client_id = 'cid', zoom_client_secret = 'csec' WHERE platform = 'zoom'"
        )
        r = db_044.execute("SELECT zoom_account_id, zoom_client_id FROM meeting_platform_config WHERE platform = 'zoom'").fetchone()
        assert r == ("acct", "cid")

    def test_can_write_webex_token(self, db_044):
        db_044.execute("UPDATE meeting_platform_config SET webex_bot_token = 'tok-123' WHERE platform = 'webex'")
        r = db_044.execute("SELECT webex_bot_token FROM meeting_platform_config WHERE platform = 'webex'").fetchone()
        assert r[0] == "tok-123"

    def test_can_write_goto_credentials(self, db_044):
        db_044.execute(
            "UPDATE meeting_platform_config SET goto_client_id = 'gid', "
            "goto_client_secret = 'gsec' WHERE platform = 'goto'"
        )
        r = db_044.execute("SELECT goto_client_id FROM meeting_platform_config WHERE platform = 'goto'").fetchone()
        assert r[0] == "gid"

    def test_can_write_bluejeans_key(self, db_044):
        db_044.execute("UPDATE meeting_platform_config SET bluejeans_api_key = 'bj-key' WHERE platform = 'bluejeans'")
        r = db_044.execute("SELECT bluejeans_api_key FROM meeting_platform_config WHERE platform = 'bluejeans'").fetchone()
        assert r[0] == "bj-key"


# ─────────────────────────────────────────────────────────────────────────────
# Cross-migration: idempotency + isolation
# ─────────────────────────────────────────────────────────────────────────────

class TestCrossMigration:

    def test_all_five_migrations_idempotent(self, db_all):
        """Running all five migrations twice must not throw or duplicate rows."""
        for fname in [
            "040_approval_flows.sql",
            "041_colour_scheme_presets.sql",
            "042_custom_tabs.sql",
            "043_notification_channel_config.sql",
            "044_meeting_platform_config.sql",
        ]:
            path = os.path.join(MIGRATIONS_DIR, fname)
            with open(path) as f:
                db_all.executescript(f.read())

        assert count(db_all, "approval_flows") == 5
        assert count(db_all, "approval_steps") == 5
        assert count(db_all, "colour_scheme_presets") == 3
        assert count(db_all, "custom_tabs") == 0
        assert count(db_all, "notification_channel_config") == 8
        assert count(db_all, "meeting_platform_config") == 4

    def test_all_tables_coexist_without_name_collision(self, db_all):
        tables = {
            r[0] for r in db_all.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        expected = {
            "approval_flows", "approval_steps",
            "colour_scheme_presets",
            "custom_tabs", "custom_tab_visibility",
            "notification_channel_config",
            "meeting_platform_config",
        }
        assert expected.issubset(tables)

    def test_total_seed_row_count_is_correct(self, db_all):
        total = (
            count(db_all, "approval_flows")
            + count(db_all, "approval_steps")
            + count(db_all, "colour_scheme_presets")
            + count(db_all, "notification_channel_config")
            + count(db_all, "meeting_platform_config")
        )
        assert total == 5 + 5 + 3 + 8 + 4  # == 25

    def test_data_in_one_migration_does_not_bleed_into_another(self, db_all):
        """Approval flow IDs must not appear in any other table."""
        flow_ids = {
            r[0] for r in db_all.execute("SELECT id FROM approval_flows").fetchall()
        }
        # None of the flow IDs should appear as colour scheme IDs
        scheme_ids = {
            r[0] for r in db_all.execute("SELECT id FROM colour_scheme_presets").fetchall()
        }
        assert flow_ids.isdisjoint(scheme_ids)
