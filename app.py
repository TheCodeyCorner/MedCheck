from flask import Flask, render_template, request
import duckdb
import csv
import re

app = Flask(__name__)

# =========================================================
# FILE PATHS
# =========================================================

MEDICINES = "database/medicines.csv"
FAVOURITES = "database/favourites.csv"
RESULTS = "database/results.csv"

# =========================================================
# CALCULATE COMPARABLE COST
# =========================================================

def calculate_cost(cost, medicine_type, quantity):

    try:
        cost = float(cost)
        match = re.search(
            r"\d+(?:\.\d+)?",
            str(quantity)
        )
        if not match:
            return None
        quantity_value = float(match.group())
    except (ValueError, AttributeError):
        return None
    if quantity_value <= 0:
        return None
    medicine_type = str(
        medicine_type
    ).strip().lower()


    # -----------------------------------------------------
    # COUNT-BASED
    # -----------------------------------------------------

    if medicine_type in [
        "tablet",
        "capsule",
        "lozenge",
        "sachet",
        "patch",
        "suppository"
    ]:
        return (
            cost / quantity_value,
            medicine_type
        )

    # -----------------------------------------------------
    # WEIGHT-BASED
    # -----------------------------------------------------

    if medicine_type in [
        "cream",
        "gel",
        "granules",
        "ointment",
        "powder"
    ]:
        return (
            (cost / quantity_value) * 100,
            "100 g"
        )

    # -----------------------------------------------------
    # VOLUME-BASED
    # -----------------------------------------------------

    if medicine_type in [
        "drops",
        "injection",
        "lotion",
        "solution",
        "suspension",
        "syrup"
    ]:
        return (
            (cost / quantity_value) * 100,
            "100 ml"
        )

    # -----------------------------------------------------
    # UNIT-BASED
    # -----------------------------------------------------

    if medicine_type in [
        "bottle",
        "inhaler",
        "tube",
        "vial"
    ]:
        return (
            cost / quantity_value,
            medicine_type
        )
    return None

# =========================================================
# MEDICINE CARD
# =========================================================

def card(row, favourite=False, index=0):
    (
        medicine_id,
        name,
        manufacturer,
        manufacturer_type,
        ingredient,
        cost,
        medicine_type,
        quantity
    ) = row
    manufacturer_type = str(manufacturer_type).strip().lower()
    medicine_type = str(medicine_type).strip().lower()

    # -----------------------------------------------------
    # FAVORITE
    # -----------------------------------------------------
    heart = "♥" if favourite else "♡"
    favourite_class = "active" if favourite else ""

    # -----------------------------------------------------
    # CALCULATED COST
    # -----------------------------------------------------
    calculated = calculate_cost(cost, medicine_type, quantity)

    if calculated:
        unit_cost, unit = calculated
        cost_html = f"""
        <div class="medicine {manufacturer_type}">
          <div class="medicine-cost-per-tablet">
            ₹{unit_cost:.2f} / <span class="medicine">{unit}</span>
          </div>
          <div class="medicine-tablets">
            pack of {quantity}: <span class="medicine-cost">₹{float(cost):.2f}</span>
          </div>
        </div>
        """
    else:
        cost_html = f"""
        <div class="medicine {manufacturer_type}">
          <div class="medicine-cost">₹{float(cost):.2f}</div>
        </div>
        """

    # =====================================================
    # CARD HTML
    # =====================================================
    return f"""
    <div class="medicine-card" style="--i: {index};">
        <div class="medicine-type {manufacturer_type}">
          {manufacturer_type.capitalize()}
        </div>
        <div class="medicine-name">{name}</div>
        <div class="medicine-type">{medicine_type}</div>
        <hr>
        <div class="medicine-manufacturer">
          Manufacturer:<br>
          <div class="manufacturer">{manufacturer}</div>
        </div>
        <div class="medicine-active-ing">
          Active Ingredient:<br>
          <div class="active-ingredient">{ingredient}</div>
        </div>
        {cost_html}
    </div>
    """

# =========================================================
# SAVE SEARCH RESULTS
# =========================================================

RESULTS_FIELDS = [
    "id",
    "name",
    "manufacturer",
    "manufacturer_type",
    "active_ingredient",
    "cost",
    "medicine_type",
    "quantity"
]

def save_results(results):
    with open(
        RESULTS,
        "w",
        newline="",
        encoding="utf-8"
    ) as file:
        writer = csv.writer(file)
        writer.writerow(RESULTS_FIELDS)
        writer.writerows(results)

def reset_results():
    save_results([])

# =========================================================
# HOME
# =========================================================

@app.route("/")
def home():
    return render_template(
        "index.html"
    )

# =========================================================
# FAVORITES PAGE
# =========================================================

@app.route("/favorites")
def favorites():
    return render_template(
        "favorites.html"
    )

# =========================================================
# SEARCH MEDICINES
# =========================================================

@app.route(
    "/api/medicines",
    methods=["POST"]
)
def search():

    data = request.get_json(silent=True) or {}

    search_value = data.get("name", "").strip()
    search_type = data.get("search_type", "active").strip().lower()

    if not search_value:
        return """
        <p>Please enter a search term.</p>
        """

    # -----------------------------------------------------
    # SEARCH BY ACTIVE INGREDIENT
    # -----------------------------------------------------

    if search_type == "active":

        query_results = duckdb.sql("""
            SELECT
                id,
                name,
                manufacturer,
                manufacturer_type,
                active_ingredient,
                cost,
                medicine_type,
                quantity
            FROM read_csv_auto(?)
            WHERE LOWER(active_ingredient) LIKE LOWER(?)
            ORDER BY
                levenshtein(
                    LOWER(active_ingredient),
                    LOWER(?)
                ) ASC,
                LENGTH(active_ingredient) ASC
            LIMIT 20
        """, params=[
            MEDICINES,
            f"%{search_value}%",
            search_value
        ]).fetchall()

    # -----------------------------------------------------
    # SEARCH BY MEDICINE NAME
    # -----------------------------------------------------

    elif search_type == "name":

        query_results = duckdb.sql("""
            SELECT
                id,
                name,
                manufacturer,
                manufacturer_type,
                active_ingredient,
                cost,
                medicine_type,
                quantity
            FROM read_csv_auto(?)
            WHERE LOWER(name) LIKE LOWER(?)
            ORDER BY
                levenshtein(
                    LOWER(name),
                    LOWER(?)
                ) ASC,
                LENGTH(name) ASC
            LIMIT 20
        """, params=[
            MEDICINES,
            f"%{search_value}%",
            search_value
        ]).fetchall()

    # -----------------------------------------------------
    # INVALID SEARCH TYPE
    # -----------------------------------------------------

    else:

        return """
        <p>Invalid search type.</p>
        """

    # -----------------------------------------------------
    # NO MATCHES
    # -----------------------------------------------------

    if not query_results:

        save_results([])

        return """
        <p>No medicines found.</p>
        """

    # -----------------------------------------------------
    # SAVE RESULTS
    # -----------------------------------------------------

    save_results(query_results)

    # -----------------------------------------------------
    # GENERATE CARDS
    # -----------------------------------------------------

    cards_html = ""

    for index, row in enumerate(query_results):

        cards_html += card(
            row,
            index=index
        )

    return cards_html


# =========================================================
# START SERVER
# =========================================================

if __name__ == "__main__":
    reset_results()
    app.run(
        debug=True
    )