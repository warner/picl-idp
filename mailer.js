var nodemailer = require('nodemailer')
var P = require('p-promise')

function Mailer(config) {
	this.mailer = nodemailer.createTransport(
		'SMTP',
		{
			host: config.host,
			secureConnection: config.secure,
			port: config.port,
			auth: {
				user: config.user,
				pass: config.password
			}
		}
	)
	this.sender = config.sender
	this.subject = config.subject
}

Mailer.prototype.sendCode = function (email, code) {
	var d = P.defer()
	var mail = {
		sender: this.sender,
		to: email,
		subject: this.subject,
		text: code
	}
	this.mailer.sendMail(
		mail,
		function (err, status) {
			return err ? d.reject(err) : d.resolve(status)
		}
	)
	return d.promise
}

module.exports = Mailer
