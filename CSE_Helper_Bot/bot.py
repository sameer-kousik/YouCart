import json
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes, MessageHandler, filters
from utils import load_user_data, save_user_data, load_material_data
from gemini import ask_gemini

BOT_TOKEN = "YOUR_TELEGRAM_BOT_TOKEN"

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    users = load_user_data()
    if user.id not in users:
        users[user.id] = {"name": user.first_name}
        save_user_data(users)
        await update.message.reply_text(f"🔷 New User!\nTotal: [{len(users)}]\nName: {user.first_name}")

    keyboard = [
        [InlineKeyboardButton("I Year", callback_data="year_I")],
        [InlineKeyboardButton("II YEAR", callback_data="year_II")],
        [InlineKeyboardButton("III Year", callback_data="year_III")],
        [InlineKeyboardButton("IV Year", callback_data="year_IV")],
        [InlineKeyboardButton("Percentage Calculator", callback_data="percentage")],
        [InlineKeyboardButton("Aptitude Materials", callback_data="aptitude")]
    ]
    await update.message.reply_text("Choose an option:", reply_markup=InlineKeyboardMarkup(keyboard))

async def handle_query(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    data = query.data
    if data.startswith("year_"):
        year = data.split("_")[1]
        keyboard = [
            [InlineKeyboardButton("I Semester", callback_data=f"{year}_sem1")],
            [InlineKeyboardButton("II Semester", callback_data=f"{year}_sem2")],
            [InlineKeyboardButton("Main menu", callback_data="main_menu")]
        ]
        await query.edit_message_text(f"{year} YEAR", reply_markup=InlineKeyboardMarkup(keyboard))

    elif "_sem" in data:
        year = data[0]
        keyboard = [
            [InlineKeyboardButton("Lab Manuals", callback_data=f"{data}_lab")],
            [InlineKeyboardButton("Notes", callback_data=f"{data}_notes")],
            [InlineKeyboardButton("Syllabus", callback_data=f"{data}_syllabus")],
            [InlineKeyboardButton("Time Tables", callback_data=f"{data}_tt")],
            [InlineKeyboardButton("Reference Books", callback_data=f"{data}_ref")],
            [InlineKeyboardButton("Previous & Model Question Papers", callback_data=f"{data}_qp")],
            [InlineKeyboardButton("Back", callback_data=f"year_{year}")]
        ]
        await query.edit_message_text(f"{data.replace('_', ' ')}", reply_markup=InlineKeyboardMarkup(keyboard))

    elif data == "main_menu":
        await start(update, context)

    elif data == "percentage":
        await query.edit_message_text("Use this calculator: https://dummy-link.com/percentage")
    elif data == "aptitude":
        await query.edit_message_text("Aptitude Materials: https://dummy-link.com/aptitude")

    else:
        year, sem, category = data.split("_")
        content = load_material_data(year.upper())
        link = content.get(sem.upper(), {}).get(category, "No data available")
        await query.edit_message_text(f"📄 {category.capitalize()}:\n{link}")

async def llm_query(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_input = update.message.text
    response = ask_gemini(user_input)
    await update.message.reply_text(response)

async def start_bot():
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(handle_query))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, llm_query))
    await app.initialize()
    await app.start()
    print("Bot started.")
    await app.updater.start_polling()
