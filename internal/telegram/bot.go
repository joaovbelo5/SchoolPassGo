package telegram

import (
	"fmt"
	"log"
	"strings"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
	"github.com/joaob/schoolpassgo/internal/repository"
)

var Bot *tgbotapi.BotAPI

// StartBot checks if token is set, and boots the polling loop
func StartBot(token string) {
	if token == "" {
		log.Println("Telegram Token not provided. Skipping bot start.")
		return
	}

	bot, err := tgbotapi.NewBotAPI(token)
	if err != nil {
		log.Printf("Failed to authorize Telegram Bot: %v\n", err)
		return
	}

	Bot = bot
	log.Printf("Authorized Telegram Bot on account %s", bot.Self.UserName)

	u := tgbotapi.NewUpdate(0)
	u.Timeout = 60

	updates := bot.GetUpdatesChan(u)

	for update := range updates {
		if update.Message == nil { // ignore any non-Message updates
			continue
		}

		chatID := update.Message.Chat.ID

		if update.Message.Contact != nil {
			phone := update.Message.Contact.PhoneNumber
			log.Printf("Received contact: %s from ChatID: %d\n", phone, chatID)

			err := tryLinkPhone(phone, chatID)
			msg := tgbotapi.NewMessage(chatID, "")
			if err != nil {
				msg.Text = "Desculpe, não conseguimos encontrar um aluno com esse telefone cadastrado.\n\nPor favor, peça à secretaria para verificar o 'Telefone do Responsável' na ficha e envie seu contato novamente."
			} else {
				msg.Text = "✅ Celular reconhecido! A partir de agora, enviaremos as notificações de entrada e saída por aqui."
			}
			bot.Send(msg)
			continue
		}

		if update.Message.IsCommand() && update.Message.Command() == "start" {
			msg := tgbotapi.NewMessage(chatID, "Bem vindo ao painel de alertas do *SchoolPassGo*!\n\nPara começarmos a avisá-lo das entradas do(s) aluno(s), clique no botão abaixo para compartilhar com a Inteligência o seu número:")
			msg.ParseMode = "Markdown"

			btn := tgbotapi.KeyboardButton{
				Text:           "Enviar meu número de telefone",
				RequestContact: true,
			}
			keyboard := tgbotapi.NewReplyKeyboard(tgbotapi.NewKeyboardButtonRow(btn))
			keyboard.OneTimeKeyboard = true
			keyboard.ResizeKeyboard = true
			msg.ReplyMarkup = keyboard

			bot.Send(msg)
		} else {
			msg := tgbotapi.NewMessage(chatID, "Por favor, digite o comando /start para que o sistema funcione.")
			bot.Send(msg)
		}
	}
}

func tryLinkPhone(phone string, chatID int64) error {
	phoneClean := strings.ReplaceAll(phone, "+", "")
	phoneClean = strings.ReplaceAll(phoneClean, "-", "")
	phoneClean = strings.ReplaceAll(phoneClean, " ", "")

	chatStr := fmt.Sprintf("%d", chatID)
	// Fallback mechanism: we actually query all students and match the normalized string
	alunos, err := repository.GetAlunos()
	if err != nil {
		return err
	}

	for _, a := range alunos {
		dbPhone := strings.ReplaceAll(a.TelefoneResponsavel, "+", "")
		dbPhone = strings.ReplaceAll(dbPhone, "-", "")
		dbPhone = strings.ReplaceAll(dbPhone, " ", "")

		if dbPhone != "" && dbPhone == phoneClean {
			_, err := repository.UpdateTelegramChatID(a.TelefoneResponsavel, chatStr)
			if err == nil {
				return nil
			}
		}
	}

	return fmt.Errorf("telefone not found")
}

func SendMessage(chatIdStr, text string) {
	if Bot == nil || chatIdStr == "" {
		return
	}

	var chatID int64
	_, err := fmt.Sscanf(chatIdStr, "%d", &chatID)
	if err != nil {
		return
	}

	msg := tgbotapi.NewMessage(chatID, text)
	msg.ParseMode = "Markdown"
	_, err = Bot.Send(msg)
	if err != nil {
		log.Printf("Error sending message to Telegram: %v\n", err)
	}
}
