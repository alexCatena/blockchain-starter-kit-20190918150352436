/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict'
/**
 * Write the unit tests for your transction processor functions here
 */

const AdminConnection = require('composer-admin').AdminConnection
const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection
const { BusinessNetworkDefinition, CertificateUtil, IdCard } = require('composer-common')
const path = require('path')

const chai = require('chai')
chai.should()
chai.use(require('chai-as-promised'))

const namespace = 'org.catena'
const assetType = 'SupplyChainRequest'
const assetTypeUp = 'UpliftOrder'
const assetNS = namespace + '.' + assetType
const assetNSUp = namespace + '.' + assetTypeUp

const participantType = 'Distributor'
const participantNS = namespace + '.' + participantType

const participantTypeTrans = 'Transporter'
const participantNSTrans = namespace + '.' + participantTypeTrans

const participantTypeMan = 'Manufacturer'
const participantNSMan = namespace + '.' + participantTypeMan

const participantTypeCust = 'Customer'
const participantNSCust = namespace + '.' + participantTypeCust

describe('#' + namespace, () => {
    // In-memory card store for testing so cards are not persisted to the file system
    const cardStore = require('composer-common').NetworkCardStoreManager.getCardStore( { type: 'composer-wallet-inmemory' } )

    // Embedded connection used for local testing
    const connectionProfile = {
        name: 'embedded',
        'x-type': 'embedded'
    }

    // Name of the business network card containing the administrative identity for the business network
    const adminCardName = 'admin'

    // Admin connection to the blockchain, used to deploy the business network
    let adminConnection

    // This is the business network connection the tests will use.
    let businessNetworkConnection

    // This is the factory for creating instances of types.
    let factory

    // These are the identities for Alice and Bob.
    const africoilCardName = 'africoil'

    // These are a list of receieved events.
    let events

    let businessNetworkName


    /**
 *
 * @param {String} cardName The card name to use for this identity
 * @param {Object} identity The identity details
 */
    async function importCardForIdentity(cardName, identity) {
        const metadata = {
            userName: identity.userID,
            version: 1,
            enrollmentSecret: identity.userSecret,
            businessNetwork: businessNetworkName
        }
        const card = new IdCard(metadata, connectionProfile)
        await adminConnection.importCard(cardName, card)
    }

    before(async () => {
        // Generate certificates for use with the embedded connection
        const credentials = CertificateUtil.generate({ commonName: 'admin' })

        // Identity used with the admin connection to deploy business networks
        const deployerMetadata = {
            version: 1,
            userName: 'PeerAdmin',
            roles: [ 'PeerAdmin', 'ChannelAdmin' ]
        }
        const deployerCard = new IdCard(deployerMetadata, connectionProfile)
        deployerCard.setCredentials(credentials)
        const deployerCardName = 'PeerAdmin'

        adminConnection = new AdminConnection({ cardStore: cardStore })

        await adminConnection.importCard(deployerCardName, deployerCard)
        await adminConnection.connect(deployerCardName)
    })


    // This is called before each test is executed.
    beforeEach(async () => {
        // Generate a business network definition from the project directory.
        let businessNetworkDefinition = await BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..'))
        businessNetworkName = businessNetworkDefinition.getName()
        await adminConnection.install(businessNetworkDefinition)
        const startOptions = {
            networkAdmins: [
                {
                    userName: 'admin',
                    enrollmentSecret: 'adminpw'
                }
            ]
        }
        const adminCards = await adminConnection.start(businessNetworkName, businessNetworkDefinition.getVersion(), startOptions)
        await adminConnection.importCard(adminCardName, adminCards.get('admin'))

        // Create and establish a business network connection
        businessNetworkConnection = new BusinessNetworkConnection({ cardStore: cardStore })
        events = []
        businessNetworkConnection.on('event', event => {
            events.push(event)
        })
        await businessNetworkConnection.connect(adminCardName)

        // Get the factory for the business network.
        factory = businessNetworkConnection.getBusinessNetwork().getFactory()

        const participantRegistry = await businessNetworkConnection.getParticipantRegistry(participantNS)
        // Create the participants.
        const africoil = factory.newResource(namespace, participantType, 'D001')
        const cust = factory.newResource(namespace, participantTypeCust, 'C001')
        const manu = factory.newResource(namespace, participantTypeMan, 'M001')
        const trans = factory.newResource(namespace, participantTypeTrans, 'T001')
        africoil.name = 'test'
        cust.name = 'test'
        manu.name = 'test'
        trans.name = 'test'
        await participantRegistry.addAll([africoil, cust, manu, trans])

        // const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNS)
        // // Create the assets.
        // const asset1 = factory.newResource(namespace, assetType, '1')
        // asset1.owner = factory.newRelationship(namespace, participantType, 'alice@email.com')
        // asset1.value = '10'

        // const asset2 = factory.newResource(namespace, assetType, '2')
        // asset2.owner = factory.newRelationship(namespace, participantType, 'bob@email.com')
        // asset2.value = '20'

        // assetRegistry.addAll([asset1, asset2])

        // Issue the identities.
        let identity = await businessNetworkConnection.issueIdentity(participantNS + '#D001', 'D001')
        await importCardForIdentity(africoilCardName, identity)
    })

    /**
     * Reconnect using a different identity.
     * @param {String} cardName The name of the card for the identity to use
     */
    async function useIdentity(cardName) {
        await businessNetworkConnection.disconnect()
        businessNetworkConnection = new BusinessNetworkConnection({ cardStore: cardStore })
        events = []
        businessNetworkConnection.on('event', (event) => {
            events.push(event)
        })
        await businessNetworkConnection.connect(cardName)
        factory = businessNetworkConnection.getBusinessNetwork().getFactory()
    }
    /**
     * Funtion to be reused to create a supply chain request at the beginning of tests
     */
    async function createSupplyChainRequest() {
        const transaction = factory.newTransaction(namespace, 'createSupplyChainRequest')
        transaction.customer = factory.newRelationship(namespace, 'Customer', 'C001')
        transaction.distributor = factory.newRelationship(namespace, 'Distributor', 'D001')
        transaction.fuelAmount = 8000
        transaction.cost = 15000
        transaction.deliveryDate = new Date()

        await businessNetworkConnection.submitTransaction(transaction)
    }
    /**
     *  Returns the identifier when the id is part of a relationship
     * @param {String} id
     */
    function fixResourceIdentifier(id){
        var n = id.indexOf('=')
        return id.substring(n+1,id.length-1)
    }
    /**
     * Function to be reused to create uplift order
     */
    async function createUpliftOrder () {
        await createSupplyChainRequest()
        const transaction = factory.newTransaction(namespace, 'createUpliftOrder')
        transaction.collectionDate = new Date()
        transaction.volume = 10000

        transaction.supplyChainRequest = factory.newRelationship('org.catena', 'SupplyChainRequest', '1')
        transaction.distributor = factory.newRelationship('org.catena', 'Distributor','D001')
        transaction.manufacturer = factory.newRelationship('org.catena','Manufacturer','M001')
        transaction.transporter = factory.newRelationship('org.catena', 'Transporter', 'T001')
        console.log('Finished creating uplift order')
        await businessNetworkConnection.submitTransaction(transaction)
    }
    it('Can create a supply chain request', async () => {
        await useIdentity(africoilCardName)

        const transaction = factory.newTransaction(namespace, 'createSupplyChainRequest')
        transaction.customer = factory.newRelationship(namespace, 'Customer','C001')
        transaction.distributor = factory.newRelationship(namespace, 'Distributor', 'D001')
        transaction.fuelAmount = 8000
        transaction.cost = 15000
        transaction.deliveryDate = new Date()

        await businessNetworkConnection.submitTransaction(transaction)

        const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNS)

        let assets = await assetRegistry.getAll()

        let scr = assets[0]

        scr.fuelAmount.should.equal(8000)
        scr.cost.should.equal(15000)
    })

    it('Can confirm supply', async () => {
        await useIdentity(africoilCardName)

        await createSupplyChainRequest()

        const transaction = factory.newTransaction(namespace, 'confirmSupply')
        transaction.scr = factory.newRelationship(namespace, 'SupplyChainRequest', '1')

        await businessNetworkConnection.submitTransaction(transaction)

        const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNS)

        let assets = await assetRegistry.getAll()

        let scr = assets[0]

        scr.supplyConfirmed.should.equal(true)
    })

    it('Can add supply request  docs', async () => {
        await useIdentity(africoilCardName)

        await createSupplyChainRequest()

        const transaction = factory.newTransaction(namespace, 'addSupplyRequestRecord')
        transaction.scr = factory.newRelationship(namespace, 'SupplyChainRequest', '1')

        transaction.supplyRequestRecordHash = 'ABC'
        transaction.supplyRequestRecordUrl = 'Thisisaurl'

        await businessNetworkConnection.submitTransaction(transaction)

        const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNS)

        let assets = await assetRegistry.getAll()

        let scr = assets[0]

        scr.supplyRequestRecordUrl.should.equal('Thisisaurl')
        scr.supplyRequestRecordHash.should.equal('ABC')

    })

    it('Can add purchase order docs', async () => {
        await useIdentity(africoilCardName)

        await createSupplyChainRequest()

        const transaction = factory.newTransaction(namespace, 'addPurchaseOrder')
        transaction.scr = factory.newRelationship(namespace, 'SupplyChainRequest', '1')

        transaction.purchaseOrderHash = 'ABC'
        transaction.purchaseOrderUrl = 'Thisisaurl'

        await businessNetworkConnection.submitTransaction(transaction)

        const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNS)

        let assets = await assetRegistry.getAll()

        let scr = assets[0]

        scr.purchaseOrderUrl.should.equal('Thisisaurl')
        scr.purchaseOrderHash.should.equal('ABC')

    })

    it('Can add Distibutor invoice docs', async () => {
        await useIdentity(africoilCardName)

        await createSupplyChainRequest()

        const transaction = factory.newTransaction(namespace, 'addDistributorInvoice')
        transaction.scr = factory.newRelationship(namespace, 'SupplyChainRequest', '1')

        transaction.distributorInvoiceHash = 'ABC'
        transaction.distributorInvoiceUrl = 'Thisisaurl'

        await businessNetworkConnection.submitTransaction(transaction)

        const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNS)

        let assets = await assetRegistry.getAll()

        let scr = assets[0]

        scr.distributorInvoiceUrl.should.equal('Thisisaurl')
        scr.distributorInvoiceHash.should.equal('ABC')

    })

    it('Can Create and uplift order', async () => {
        var NS = 'org.catena'

        await useIdentity(africoilCardName)

        await createUpliftOrder()

        const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNSUp)

        let assets = await assetRegistry.getAll()

        let uplift = assets[0]

        uplift.volume.should.equal(10000)
        fixResourceIdentifier(uplift.supplyChainRequest.getFullyQualifiedIdentifier()).should.equal(NS + '.SupplyChainRequest#1')
        fixResourceIdentifier(uplift.distributor.getFullyQualifiedIdentifier()).should.equal(NS +'.Distributor#D001')
        fixResourceIdentifier(uplift.manufacturer.getFullyQualifiedIdentifier()).should.equal(NS +'.Manufacturer#M001')
        fixResourceIdentifier(uplift.transporter.getFullyQualifiedIdentifier()).should.equal(NS+'.Transporter#T001')
    })

    it('Can add collection order document', async () => {
        await useIdentity(africoilCardName)

        await createUpliftOrder()

        const transaction = factory.newTransaction(namespace, 'addCollectionOrderDocument')

        transaction.upliftOrder = factory.newRelationship(namespace, 'UpliftOrder', '1')

        transaction.collectionOrderDocumentHash = 'ABC'
        transaction.collectionOrderDocumentUrl = 'Thisisaurl'

        await businessNetworkConnection.submitTransaction(transaction)

        const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNSUp)

        let assets = await assetRegistry.getAll()

        let up =  assets[0]

        up.collectionOrderDocumentHash.should.equal('ABC')
        up.collectionOrderDocumentUrl.should.equal('Thisisaurl')
    })

    it('add collection Receipt Document', async () => {
        await useIdentity(africoilCardName)

        await createUpliftOrder()

        const transaction = factory.newTransaction(namespace, 'addCollectionReceiptDocument')

        transaction.upliftOrder = factory.newRelationship(namespace, 'UpliftOrder', '1')

        transaction.collectionReceiptDocumentHash = 'ABC'
        transaction.collectionReceiptDocumentUrl = 'Thisisaurl'

        await businessNetworkConnection.submitTransaction(transaction)

        const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNSUp)

        let assets = await assetRegistry.getAll()

        let up = assets[0]

        up.collectionReceiptDocumentHash.should.equal('ABC')
        up.collectionReceiptDocumentUrl.should.equal('Thisisaurl')
    })


    it('add manufacturerInvoice', async () => {
        await useIdentity(africoilCardName)

        await createUpliftOrder()

        const transaction = factory.newTransaction(namespace, 'addManufacturerInvoice')

        transaction.upliftOrder = factory.newRelationship(namespace, 'UpliftOrder', '1')

        transaction.manufacturerInvoiceHash = 'ABC'
        transaction.manufacturerInvoiceUrl = 'Thisisaurl'

        await businessNetworkConnection.submitTransaction(transaction)

        const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNSUp)

        let assets = await assetRegistry.getAll()

        let up = assets[0]

        up.manufacturerInvoiceHash.should.equal('ABC')
        up.manufacturerInvoiceUrl.should.equal('Thisisaurl')
    })


    it('add transportation Invoice', async () => {
        await useIdentity(africoilCardName)

        await createUpliftOrder()

        const transaction = factory.newTransaction(namespace, 'addTransportationInvoice')

        transaction.upliftOrder = factory.newRelationship(namespace, 'UpliftOrder', '1')

        transaction.transportationInvoiceHash = 'ABC'
        transaction.transportationInvoiceUrl = 'Thisisaurl'

        await businessNetworkConnection.submitTransaction(transaction)

        const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNSUp)

        let assets = await assetRegistry.getAll()

        let up = assets[0]

        up.transportationInvoiceHash.should.equal('ABC')
        up.transportationInvoiceUrl.should.equal('Thisisaurl')
    })

    it('Can confirm collection date', async () => {
        await useIdentity(africoilCardName)

        await createUpliftOrder()

        const transaction = factory.newTransaction(namespace, 'confirmCollectionDate')
        transaction.upliftOrder = factory.newRelationship(namespace,'UpliftOrder', '1')

        await businessNetworkConnection.submitTransaction(transaction)

        const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNSUp)

        let assets = await assetRegistry.getAll()

        let up = assets[0]

        up.collectionDateConfirmed = true
    })
})
