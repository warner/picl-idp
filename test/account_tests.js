var test = require('tap').test
var P = require('p-promise')

var dbs = require('../kv')(
  {
    kvstore: {
      available_backends: ['memory'],
      backend: 'memory',
      cache: 'memory'
    }
  }
)

var mailer = {
  sendCode: function () { return P(null) }
}

var config = {
  domain: 'example.com',
  dev: {}
}
var models = require('../models')(config, dbs, mailer)
var Account = models.Account
var RecoveryMethod = models.RecoveryMethod
var SessionToken = models.tokens.SessionToken
var AccountResetToken = models.tokens.AccountResetToken

var a = {
  uid: 'xxx',
  email: 'somebody@example.com',
  verifier: 'BAD1',
  salt: 'BAD2',
  kA: 'BAD3',
  wrapKb: 'BAD4'
}

test(
  'Account.principal uses the given uid and adds the domain',
  function (t) {
    t.equal(Account.principal('xyz'), 'xyz@' + config.domain)
    t.end()
  }
)

test(
  'Account.create adds a new account',
  function (t) {
    Account.create(a)
      .then(Account.get.bind(null, a.uid))
      .then(
        function (account) {
          t.equal(account.email, a.email)
        }
      )
      .then(Account.del.bind(null, a.uid))
      .done(
        function () { t.end() },
        function (err) { t.fail(err); t.end() })
  }
)

test(
  'Account.create adds a primary recovery method',
  function (t) {
    Account.create(a)
      .then(Account.get.bind(null, a.uid))
      .then(
        function (account) {
          t.equal(account.recoveryMethodIds[a.email], true)
        }
      )
      .then(RecoveryMethod.get.bind(null, a.email))
      .then(
        function (rm) {
          t.equal(rm.uid, a.uid)
        }
      )
      .then(Account.del.bind(null, a.uid))
      .done(
        function () { t.end() },
        function (err) { t.fail(err); t.end() })
  }
)

test(
  'Account.create returns an error if the account exists',
  function (t) {
    Account.create(a)
      .then(Account.create.bind(null, a))
      .then(
        function () {
          t.fail('should not have created an account')
        },
        function (err) {
          t.equal(err.message, "AccountExists")
        }
      )
      .then(Account.del.bind(null, a.uid))
      .done(
        function () { t.end() },
        function (err) { t.fail(err); t.end() })
  }
)

test(
  'Account.get of an invalid uid returns null',
  function (t) {
    Account.get('foobar')
      .done(
        function (x) {
          t.equal(x, null)
          t.end()
        }
      )
  }
)

test(
  'Account.getId returns the uid given an email',
  function (t) {
    Account.create(a)
      .then(Account.getId.bind(null, a.email))
      .then(
        function (id) {
          t.equal(id, a.uid)
        }
      )
      .then(Account.del.bind(null, a.uid))
      .done(
        function () { t.end() },
        function (err) { t.fail(err); t.end() })
  }
)

test(
  'Account.exists returns false if the email is not in use',
  function (t) {
    Account.exists('nobody@example.com').done(
      function (exists) {
        t.equal(exists, false)
        t.end()
      },
      function (err) { t.fail(err); t.end() }
    )
  }
)

test(
  'Account.exists returns true if the email is in use',
  function (t) {
    Account.create(a)
      .then(Account.exists.bind(null, a.email))
      .then(
        function (exists) {
          t.equal(exists, true)
        }
      )
      .then(Account.del.bind(null, a.uid))
      .done(
        function () { t.end() },
        function (err) { t.fail(err); t.end() }
      )
  }
)

test(
  'Account.del deletes the account with the given uid',
  function (t) {
    Account.create(a)
      .then(Account.exists.bind(null, a.email))
      .then(
        function (exists) {
          t.equal(exists, true)
        }
      )
      .then(Account.del.bind(null, a.uid))
      .then(Account.get.bind(null, a.uid))
      .done(
        function (account) {
          t.equal(account, null)
          t.end()
        },
        function (err) {
          t.fail(err)
          t.end()
        }
      )
  }
)

test(
  'Account.del deletes all data related to the account',
  function (t) {
    var account = null
    var session = null
    var reset = null
    t.equal(Object.keys(dbs.store.kv.data).length, 0)
    Account.create(a)
      .then(
        function (a) {
          account = a
        }
      )
      .then(SessionToken.create.bind(null, a.uid))
      .then(
        function (t) {
          session = t
          return account.addSessionToken(session)
        }
      )
      .then(AccountResetToken.create.bind(null, a.uid))
      .then(
        function (t) {
          reset = t
          return account.setResetToken(reset)
        }
      )
      .then(
        function () {
          // 5: uid, user, recovery, reset, session
          t.equal(Object.keys(dbs.store.kv.data).length, 5)
        }
      )
      .then(Account.del.bind(null, a.uid))
      .done(
        function () {
          t.equal(Object.keys(dbs.store.kv.data).length, 0)
          t.end()
        },
        function (err) {
          t.fail(err)
          t.end()
        }
      )
  }
)

test(
  'Account.del of an invalid uid returns null',
  function (t) {
    Account.del('foobar')
      .done(
        function (x) {
          t.equal(x, null)
          t.end()
        }
      )
  }
)

test(
  'Account.verify sets verified to true when the recovery method is primary',
  function (t) {
    Account.create(a)
      .then(RecoveryMethod.get.bind(null, a.email))
      .then(
        function (x) {
          x.verified = true
          return Account.verify(x)
        }
      )
      .then(
        function (account) {
          t.equal(account.verified, true)
        }
      )
      .then(Account.del.bind(null, a.uid))
      .done(
        function () { t.end() },
        function (err) { t.fail(err); t.end() }
      )
  }
)

test(
  'Account.verify does not set verified true if recovery method is not verified',
  function (t) {
    Account.create(a)
      .then(RecoveryMethod.get.bind(null, a.email))
      .then(
        function (x) {
          return Account.verify(x)
        }
      )
      .then(
        function (account) {
          t.equal(account.verified, false)
        }
      )
      .then(Account.del.bind(null, a.uid))
      .done(
        function () { t.end() },
        function (err) { t.fail(err); t.end() }
      )
  }
)

test(
  'account.setResetToken deletes existing token',
  function (t) {
    var account = null
    var token1 = null
    var token2 = null
    AccountResetToken.create(a.uid)
      .then(
        function (x) {
          token1 = x
        }
      )
      .then(Account.create.bind(null, a))
      .then(
        function (x) {
          account = x
          return account.setResetToken(token1)
        }
      )
      .then(AccountResetToken.create.bind(null, a.uid))
      .then(
        function (x) {
          t.equal(account.resetTokenId, token1.id)
          token2 = x
          return account.setResetToken(token2)
        }
      )
      .then(
        function () {
          t.equal(account.resetTokenId, token2.id)
          return AccountResetToken.get(token1.id)
        }
      )
      .then(
        function (x) {
          t.equal(x, null)
        }
      )
      .then(Account.del.bind(null, a.uid))
      .done(
        function () { t.end() },
        function (err) { t.fail(err); t.end() }
      )
  }
)

test(
  'Account.getByEmail works',
  function (t) {
    Account.create(a)
      .then(Account.getByEmail.bind(null, a.email))
      .then(
        function (account) {
          t.equal(account.email, a.email)
        }
      )
      .then(Account.del.bind(null, a.uid))
      .done(
        function () { t.end() },
        function (err) { t.fail(err); t.end() }
      )
  }
)

test(
  'account.addSessionToken works',
  function (t) {
    var account = null
    var token = null
    Account.create(a)
      .then(
        function (x) {
          account = x
          return SessionToken.create(x.uid)
        }
      )
      .then(
        function (t) {
          token = t
          return account.addSessionToken(t)
        }
      )
      .then(
        function (x) {
          t.equal(x.sessionTokenIds[token.id], true)
        }
      )
      .then(Account.del.bind(null, a.uid))
      .done(
        function () { t.end() },
        function (err) { t.fail(err); t.end() }
      )
  }
)

test(
  'account.recoveryMethods returns an array of RecoveryMethod objects',
  function (t) {
    Account.create(a)
      .then(
        function (account) {
          return account.recoveryMethods()
        }
      )
      .then(
        function (rms) {
          t.equal(rms.length, 1)
          t.equal(rms[0] instanceof RecoveryMethod, true)
        }
      )
      .then(Account.del.bind(null, a.uid))
      .done(
        function () { t.end() },
        function (err) { t.fail(err); t.end() }
      )
  }
)

test(
  'account.reset changes wrapKb and verifier',
  function (t) {
    var form = {
      wrapKb: 'DEADBEEF',
      verifier: 'FEEDFACE',
      params: {
        stuff: true
      }
    }
    Account.create(a)
      .then(
        function (account) {
          return account.reset(form)
        }
      )
      .then(
        function (account) {
          t.equal(account.wrapKb, form.wrapKb)
          t.equal(account.verifier, form.verifier)
        }
      )
      .then(Account.del.bind(null, a.uid))
      .done(
        function () { t.end() },
        function (err) { t.fail(err); t.end() }
      )
  }
)

test(
  'account.reset deletes all tokens',
  function (t) {
    var account = null
    var session = null
    var reset = null
    var form = {
      wrapKb: 'DEADBEEF',
      verifier: 'FEEDFACE',
      params: {
        stuff: true
      }
    }
    Account.create(a)
      .then(
        function (a) {
          account = a
        }
      )
      .then(SessionToken.create.bind(null, a.uid))
      .then(
        function (x) {
          session = x
          return account.addSessionToken(session)
        }
      )
      .then(AccountResetToken.create.bind(null, a.uid))
      .then(
        function (x) {
          reset = x
          return account.setResetToken(reset)
        }
      )
      .then(
        function () {
          return account.reset(form)
        }
      )
      .then(
        function () {
          return AccountResetToken.get(reset.id)
        }
      )
      .then(
        function (x) {
          t.equal(x, null)
        }
      )
      .then(
        function () {
          return SessionToken.get(session.id)
        }
      )
      .then(
        function (x) {
          t.equal(x, null)
        }
      )
      .then(Account.del.bind(null, a.uid))
      .done(
        function () { t.end() },
        function (err) { t.fail(err); t.end() }
      )
  }
)
