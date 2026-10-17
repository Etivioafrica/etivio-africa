"""Regenerate the public-schema block of src/lib/database.types.ts without Docker.

Usage:
  psql "<conn>" -tA -f scripts/schema.sql > schema.json
  python3 scripts/gen-types.py schema.json
"""
import json
import re
import sys
from pathlib import Path

TYPES = Path(__file__).resolve().parent.parent / "src/lib/database.types.ts"

SCALARS = {
    "uuid": "string", "text": "string", "character varying": "string", "citext": "string",
    "timestamp with time zone": "string", "timestamp without time zone": "string", "date": "string",
    "time without time zone": "string", "interval": "string", "bytea": "string",
    "integer": "number", "smallint": "number", "bigint": "number", "numeric": "number",
    "real": "number", "double precision": "number",
    "boolean": "boolean", "json": "Json", "jsonb": "Json",
}

schema = json.load(open(sys.argv[1]))
enums = schema["enums"] or {}
public_tables = {t["name"] for t in schema["tables"]}


def ts_type(pg: str) -> str:
    array = pg.endswith("[]")
    base = re.sub(r"\(.*\)", "", pg[:-2] if array else pg).strip()
    base = base.removeprefix("public.")
    if base in enums:
        out = f'Database["public"]["Enums"]["{base}"]'
    else:
        out = SCALARS.get(base, "unknown")
    return f"{out}[]" if array else out


def table_block(t):
    cols = t["columns"] or []
    row, ins, upd = [], [], []
    for c in cols:
        ty = ts_type(c["type"])
        nul = " | null" if c["nullable"] else ""
        row.append(f"          {c['name']}: {ty}{nul}")
        if c["identity_always"]:
            ins.append(f"          {c['name']}?: never")
            upd.append(f"          {c['name']}?: never")
            continue
        opt = "?" if (c["nullable"] or c["has_default"]) else ""
        ins.append(f"          {c['name']}{opt}: {ty}{nul}")
        upd.append(f"          {c['name']}?: {ty}{nul}")
    rels = [f for f in (t["fks"] or []) if f["ref_table"] in public_tables]
    if rels:
        rel_lines = ["        Relationships: ["]
        for f in rels:
            rel_lines += [
                "          {",
                f'            foreignKeyName: "{f["name"]}"',
                f"            columns: {json.dumps(f['columns'])}".replace(",", ", "),
                "            isOneToOne: false",
                f'            referencedRelation: "{f["ref_table"]}"',
                f"            referencedColumns: {json.dumps(f['ref_columns'])}".replace(",", ", "),
                "          },",
            ]
        rel_lines.append("        ]")
    else:
        rel_lines = ["        Relationships: []"]
    return "\n".join(
        [f"      {t['name']}: {{", "        Row: {", *row, "        }", "        Insert: {", *ins, "        }",
         "        Update: {", *upd, "        }", *rel_lines, "      }"]
    )


def fn_block(f):
    args = f["args"] or []
    if args:
        parts = [f"{a['name']}{'?' if a['has_default'] else ''}: {ts_type(a['type'])}" for a in args]
        args_ts = "{ " + "; ".join(parts) + " }"
    else:
        args_ts = "never"
    if f["returns_table"] and f["out"]:
        fields = "\n".join(f"          {o['name']}: {ts_type(o['type'])}" for o in f["out"])
        ret = "{\n" + fields + "\n        }[]"
    else:
        ret = ts_type(f["returns"]) if f["returns"] != "void" else "undefined"
    return f"      {f['name']}: {{\n        Args: {args_ts}\n        Returns: {ret}\n      }}"


tables = "\n".join(table_block(t) for t in schema["tables"])
functions = "\n".join(fn_block(f) for f in (schema["functions"] or []))
enum_ts = "\n".join(f"      {k}: " + " | ".join(f'"{v}"' for v in vals) for k, vals in sorted(enums.items()))
enum_const = "\n".join(f"      {k}: [" + ", ".join(f'"{v}"' for v in vals) + "]," for k, vals in sorted(enums.items()))

public = f"""  public: {{
    Tables: {{
{tables}
    }}
    Views: {{
      [_ in never]: never
    }}
    Functions: {{
{functions}
    }}
    Enums: {{
{enum_ts}
    }}
    CompositeTypes: {{
      [_ in never]: never
    }}
  }}
}}
"""

src = TYPES.read_text()
start = src.index("  public: {\n    Tables: {")
end = src.index("type DatabaseWithoutInternals")
src = src[:start] + public + "\n" + src[end:]
cstart = src.index("export const Constants = {")
src = src[:cstart] + f"""export const Constants = {{
  public: {{
    Enums: {{
{enum_const}
    }},
  }},
}} as const
"""
TYPES.write_text(src)
print(f"wrote {TYPES} ({len(schema['tables'])} tables, {len(schema['functions'] or [])} functions, {len(enums)} enums)")
